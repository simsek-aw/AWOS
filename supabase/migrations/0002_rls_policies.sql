-- ============================================================================
-- AWOS — 0002 Row-Level-Security policies
-- This is the security core. Tenant isolation lives HERE, in the database,
-- so that even a bug in the application layer cannot leak cross-customer data.
--
-- Model:
--   employee -> access to ALL boards (customer + internal)
--   customer -> access ONLY to their own customer's boards
--
-- The `service_role` key BYPASSES all of this and is used server-side only
-- (the mirroring agent, admin jobs). Never ship it to the browser.
-- ============================================================================

-- --- Helper functions (read the caller's profile) ---------------------------
-- SECURITY DEFINER so they can read `profiles` regardless of that table's RLS.

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from profiles where id = auth.uid()
$$;

create or replace function is_employee() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'employee', false)
$$;

-- Central predicate: may the caller access this board?
create or replace function can_access_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_employee()
      or exists (
        select 1 from boards b
        where b.id = p_board_id
          and b.type = 'customer'
          and b.customer_id = auth_customer_id()
      )
$$;

-- --- Enable + FORCE RLS on every table with customer data --------------------

alter table customers   enable row level security;
alter table profiles    enable row level security;
alter table boards      enable row level security;
alter table columns     enable row level security;
alter table tasks       enable row level security;
alter table task_values enable row level security;
alter table task_links  enable row level security;
alter table comments    enable row level security;
alter table audit_log   enable row level security;

alter table customers   force row level security;
alter table profiles    force row level security;
alter table boards      force row level security;
alter table columns     force row level security;
alter table tasks       force row level security;
alter table task_values force row level security;
alter table task_links  force row level security;
alter table comments    force row level security;
alter table audit_log   force row level security;

-- --- customers ---------------------------------------------------------------

create policy customers_select on customers for select to authenticated
  using (is_employee() or id = auth_customer_id());

create policy customers_write on customers for all to authenticated
  using (is_employee()) with check (is_employee());

-- --- profiles ----------------------------------------------------------------
-- Users always see their own profile; employees see all.

create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_employee());

-- Users may update their own row; employees may update any.
-- (Role/customer_id changes should be done server-side via service_role.)
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or is_employee())
  with check (id = auth.uid() or is_employee());

-- Inserts happen on signup via a trigger / service_role, so no client policy.

-- --- boards ------------------------------------------------------------------

create policy boards_select on boards for select to authenticated
  using (can_access_board(id));

-- Only employees create/modify boards.
create policy boards_write on boards for all to authenticated
  using (is_employee()) with check (is_employee());

-- --- columns -----------------------------------------------------------------

create policy columns_select on columns for select to authenticated
  using (can_access_board(board_id));

-- Only employees configure columns.
create policy columns_write on columns for all to authenticated
  using (is_employee()) with check (is_employee());

-- --- tasks -------------------------------------------------------------------
-- Customers may read AND create/update tasks on their own board.

create policy tasks_select on tasks for select to authenticated
  using (can_access_board(board_id));

create policy tasks_insert on tasks for insert to authenticated
  with check (can_access_board(board_id));

create policy tasks_update on tasks for update to authenticated
  using (can_access_board(board_id))
  with check (can_access_board(board_id));

create policy tasks_delete on tasks for delete to authenticated
  using (is_employee());

-- --- task_values -------------------------------------------------------------
-- Access derives from the task's board.

create policy task_values_select on task_values for select to authenticated
  using (exists (select 1 from tasks t
                 where t.id = task_values.task_id
                   and can_access_board(t.board_id)));

create policy task_values_write on task_values for all to authenticated
  using (exists (select 1 from tasks t
                 where t.id = task_values.task_id
                   and can_access_board(t.board_id)))
  with check (exists (select 1 from tasks t
                      where t.id = task_values.task_id
                        and can_access_board(t.board_id)));

-- --- comments ----------------------------------------------------------------
-- A customer can only ever see/write comments on tasks of their own board.
-- Internal comments live on internal-board tasks -> no customer access. Period.

create policy comments_select on comments for select to authenticated
  using (exists (select 1 from tasks t
                 where t.id = comments.task_id
                   and can_access_board(t.board_id)));

create policy comments_insert on comments for insert to authenticated
  with check (exists (select 1 from tasks t
                      where t.id = comments.task_id
                        and can_access_board(t.board_id)));

-- Authors may edit/delete their own comments; employees any.
create policy comments_modify on comments for update to authenticated
  using (author_id = auth.uid() or is_employee())
  with check (author_id = auth.uid() or is_employee());

create policy comments_delete on comments for delete to authenticated
  using (author_id = auth.uid() or is_employee());

-- --- task_links --------------------------------------------------------------
-- Purely an internal concept (which customer task mirrors which internal task).
-- Customers must not see these at all.

create policy task_links_all on task_links for all to authenticated
  using (is_employee()) with check (is_employee());

-- --- audit_log ---------------------------------------------------------------
-- Employees may read; writes happen via service_role / triggers only.

create policy audit_log_select on audit_log for select to authenticated
  using (is_employee());
