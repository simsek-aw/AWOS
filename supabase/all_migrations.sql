-- ============================================================================
-- AWOS — ALLE Migrationen 0001–0008 in einer Datei.
-- Einmalig auf einer FRISCHEN Supabase-Datenbank im SQL-Editor ausfuehren.
-- (Generiert aus supabase/migrations/ — dort liegen die Einzeldateien.)
-- ============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0001_init_schema.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- AWOS — 0001 init schema
-- Core data model: customers, profiles, boards, columns, tasks, values,
-- comments, task links (internal <-> customer mirror) and audit log.
-- RLS policies live in 0002_rls_policies.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- Enums ------------------------------------------------------------------

create type user_role   as enum ('employee', 'customer');
create type board_type  as enum ('customer', 'internal');
create type department   as enum ('marketing', 'content', 'grafik');
create type column_type  as enum ('text', 'person', 'status', 'date', 'link', 'number');

-- --- Customers (tenants) -----------------------------------------------------

create table customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- --- Profiles (extends Supabase auth.users) ----------------------------------

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        user_role not null default 'customer',
  -- customer users belong to exactly one customer; employees have NULL
  customer_id uuid references customers (id) on delete cascade,
  -- optional team for employees
  department  department,
  created_at  timestamptz not null default now(),
  -- integrity: a customer user MUST have a customer_id, an employee MUST NOT
  constraint profile_role_shape check (
    (role = 'customer' and customer_id is not null) or
    (role = 'employee' and customer_id is null)
  )
);

create index profiles_customer_id_idx on profiles (customer_id);

-- --- Boards ------------------------------------------------------------------

create table boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        board_type not null,
  -- set for customer boards, NULL for internal boards
  customer_id uuid references customers (id) on delete cascade,
  -- optional for internal boards (marketing/content/grafik)
  department  department,
  created_at  timestamptz not null default now(),
  constraint board_shape check (
    (type = 'customer' and customer_id is not null) or
    (type = 'internal' and customer_id is null)
  )
);

create index boards_customer_id_idx on boards (customer_id);

-- --- Columns (per board, customizable) --------------------------------------

create table columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards (id) on delete cascade,
  key         text not null,               -- e.g. 'name', 'pm', 'status'
  label       text not null,               -- display label
  type        column_type not null default 'text',
  position    int not null default 0,
  is_required boolean not null default false,
  -- e.g. status options: {"options":[{"label":"Offen","color":"#..."}]}
  options     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (board_id, key)
);

create index columns_board_id_idx on columns (board_id);

-- --- Tasks -------------------------------------------------------------------

create table tasks (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards (id) on delete cascade,
  title      text not null,
  position   int not null default 0,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_board_id_idx on tasks (board_id);

-- --- Task values (EAV for customizable columns) ------------------------------

create table task_values (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references tasks (id) on delete cascade,
  column_id uuid not null references columns (id) on delete cascade,
  value     jsonb not null default 'null'::jsonb,
  unique (task_id, column_id)
);

create index task_values_task_id_idx on task_values (task_id);

-- --- Task links (mirror mapping: customer task <-> internal task) ------------

create table task_links (
  id               uuid primary key default gen_random_uuid(),
  customer_task_id uuid not null references tasks (id) on delete cascade,
  internal_task_id uuid not null references tasks (id) on delete cascade,
  created_by_agent boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (customer_task_id, internal_task_id)
);

create index task_links_customer_task_idx on task_links (customer_task_id);
create index task_links_internal_task_idx on task_links (internal_task_id);

-- --- Comments ----------------------------------------------------------------
-- NOTE: There is intentionally NO "visible_to_customer" flag. Visibility is
-- decided purely by which task (and therefore which board) a comment belongs
-- to. Internal comments live on the internal task; customers have no RLS
-- access to that board, so an internal comment can never surface to a customer.

create table comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks (id) on delete cascade,
  author_id  uuid references profiles (id) on delete set null,
  is_agent   boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now()
);

create index comments_task_id_idx on comments (task_id);

-- --- Audit log ---------------------------------------------------------------

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles (id) on delete set null,
  action      text not null,               -- e.g. 'task.create', 'board.read'
  entity_type text,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_actor_idx  on audit_log (actor_id);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

-- --- updated_at trigger for tasks -------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0002_rls_policies.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0003_helpers_and_defaults.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- AWOS — 0003 helper functions & default columns
-- Server-side helpers for provisioning users and seeding a board's standard
-- columns. These are SECURITY DEFINER and meant to be called from trusted
-- server code (service_role), not directly by the browser client.
-- ============================================================================

-- Seed the standard AWOS columns for a freshly created board:
-- Task-ID, Name, PM, Macher, Status, Deadline, OneDrive (optional).
create or replace function seed_default_columns(p_board_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into columns (board_id, key, label, type, position, is_required, options) values
    (p_board_id, 'task_id',  'Task-ID',   'text',   0, false, '{}'::jsonb),
    (p_board_id, 'name',     'Name',      'text',   1, true,  '{}'::jsonb),
    (p_board_id, 'pm',       'PM',        'person', 2, false, '{}'::jsonb),
    (p_board_id, 'macher',   'Macher',    'person', 3, false, '{}'::jsonb),
    (p_board_id, 'status',   'Status',    'status', 4, false,
       jsonb_build_object('options', jsonb_build_array(
         jsonb_build_object('label','Offen',        'color','#9e9e9e'),
         jsonb_build_object('label','In Arbeit',    'color','#fdab3d'),
         jsonb_build_object('label','Review',       'color','#579bfc'),
         jsonb_build_object('label','Fertig',       'color','#00c875')
       ))),
    (p_board_id, 'deadline', 'Deadline',  'date',   5, false, '{}'::jsonb),
    (p_board_id, 'onedrive', 'OneDrive',  'link',   6, false, '{}'::jsonb)
  on conflict (board_id, key) do nothing;
end;
$$;

-- Create a board and seed its default columns in one call.
create or replace function create_board(
  p_name        text,
  p_type        board_type,
  p_customer_id uuid    default null,
  p_department  department default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_board_id uuid;
begin
  insert into boards (name, type, customer_id, department)
  values (p_name, p_type, p_customer_id, p_department)
  returning id into v_board_id;

  perform seed_default_columns(v_board_id);
  return v_board_id;
end;
$$;

-- Provision (or update) a user's profile after they are invited/signed up.
-- Enforces the role/customer_id shape from the schema.
create or replace function provision_profile(
  p_user_id     uuid,
  p_full_name   text,
  p_role        user_role,
  p_customer_id uuid       default null,
  p_department  department  default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role, customer_id, department)
  values (p_user_id, p_full_name, p_role,
          case when p_role = 'customer' then p_customer_id else null end,
          case when p_role = 'employee' then p_department else null end)
  on conflict (id) do update
    set full_name   = excluded.full_name,
        role        = excluded.role,
        customer_id = excluded.customer_id,
        department  = excluded.department;
end;
$$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0004_lock_down_functions.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- AWOS — 0004 lock down privileged helper functions
--
-- provision_profile / create_board / seed_default_columns are SECURITY DEFINER:
-- they run with owner rights and bypass RLS. Postgres grants EXECUTE to PUBLIC
-- by default, and Supabase exposes public functions as PostgREST RPC — so
-- WITHOUT this migration, any authenticated user (including a customer) could
-- call provision_profile to promote themselves to 'employee', or create_board
-- to spawn boards. These must be callable ONLY by trusted server code.
-- ============================================================================

revoke all on function provision_profile(uuid, text, user_role, uuid, department)
  from public, anon, authenticated;
revoke all on function create_board(text, board_type, uuid, department)
  from public, anon, authenticated;
revoke all on function seed_default_columns(uuid)
  from public, anon, authenticated;

-- service_role (used only by server-side code) keeps access.
grant execute on function provision_profile(uuid, text, user_role, uuid, department)
  to service_role;
grant execute on function create_board(text, board_type, uuid, department)
  to service_role;
grant execute on function seed_default_columns(uuid)
  to service_role;

-- The read-only helpers used inside RLS policies stay executable for
-- authenticated users — they only ever read the caller's own row and grant no
-- privilege on their own.

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0005_realtime.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- AWOS — 0005 Realtime
-- Publish tasks / task_values / comments to the Supabase Realtime publication
-- so boards update live. Realtime respects RLS: each subscriber only receives
-- change events for rows they are allowed to read (same policies as 0002).
--
-- REPLICA IDENTITY FULL ensures UPDATE/DELETE events carry the full old row so
-- Realtime can apply RLS to them (otherwise only the primary key is sent).
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'task_values', 'comments'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0006_harden_policies.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- AWOS — 0006 policy hardening (security review fixes)
-- ============================================================================

-- FINDING 1 (critical): privilege escalation via self-update of profiles.
-- The profiles_update policy let a user UPDATE their own row with no column
-- restriction, so a customer could set role='employee', customer_id=null and
-- gain access to every board. No app flow updates profiles through a user
-- session (profile writes go through provision_profile / service_role), so we
-- remove client write access to the table entirely and drop the policy.
drop policy if exists profiles_update on profiles;
revoke insert, update, delete on profiles from anon, authenticated;

-- FINDING 2 (medium): comment attribution spoofing. The old insert policy only
-- checked board access, so a customer could insert a comment with is_agent=true
-- or a forged author_id. Require the author to be the caller and is_agent=false.
-- The mirroring agent writes via service_role (bypasses RLS) and is unaffected.
drop policy if exists comments_insert on comments;
create policy comments_insert on comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_agent = false
    and exists (
      select 1 from tasks t
      where t.id = comments.task_id and can_access_board(t.board_id)
    )
  );

-- FINDING 4 (low, integrity): a task_value could reference a column from a
-- different board. Require the column to belong to the task's own board.
drop policy if exists task_values_write on task_values;
create policy task_values_write on task_values for all to authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = task_values.task_id and can_access_board(t.board_id)
    )
  )
  with check (
    exists (
      select 1 from tasks t
      join columns c on c.id = task_values.column_id
      where t.id = task_values.task_id
        and c.board_id = t.board_id
        and can_access_board(t.board_id)
    )
  );

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0007_attachments.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- AWOS — 0007 attachments (Supabase Storage)
-- File uploads on tasks. Access follows board access, exactly like tasks and
-- comments: a customer can only touch files on their own board.
--
-- Storage layout: attachments/<board_id>/<task_id>/<uuid>-<filename>
-- The board_id is the first path segment, so storage policies can authorize by
-- reusing can_access_board() — the same predicate used everywhere else.
-- ============================================================================

-- --- Metadata table ---------------------------------------------------------

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks (id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null,
  size_bytes   bigint,
  content_type text,
  uploaded_by  uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index attachments_task_id_idx on attachments (task_id);

alter table attachments enable row level security;
alter table attachments force row level security;

create policy attachments_select on attachments for select to authenticated
  using (exists (select 1 from tasks t
                 where t.id = attachments.task_id and can_access_board(t.board_id)));

create policy attachments_insert on attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (select 1 from tasks t
                where t.id = attachments.task_id and can_access_board(t.board_id))
  );

create policy attachments_delete on attachments for delete to authenticated
  using (uploaded_by = auth.uid() or is_employee());

-- --- Realtime ---------------------------------------------------------------

do $$
begin
  execute 'alter table public.attachments replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments'
  ) then
    execute 'alter publication supabase_realtime add table public.attachments';
  end if;
end $$;

-- --- Storage bucket + object policies ---------------------------------------
-- Guarded so this migration also applies on a plain Postgres (no storage schema)
-- during local verification; on Supabase the storage schema always exists.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
      values ('attachments', 'attachments', false)
      on conflict (id) do nothing;

    -- Reads: only within a board the caller can access.
    execute $p$
      create policy "attachments_read" on storage.objects for select to authenticated
        using (
          bucket_id = 'attachments'
          and can_access_board(((storage.foldername(name))[1])::uuid)
        )$p$;

    -- Uploads: same board-access check.
    execute $p$
      create policy "attachments_write" on storage.objects for insert to authenticated
        with check (
          bucket_id = 'attachments'
          and can_access_board(((storage.foldername(name))[1])::uuid)
        )$p$;

    -- Deletes: uploader (object owner) or any employee.
    execute $p$
      create policy "attachments_remove" on storage.objects for delete to authenticated
        using (
          bucket_id = 'attachments'
          and (is_employee() or owner = auth.uid())
        )$p$;
  end if;
end $$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0008_notifications.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- AWOS — 0008 notifications
-- In-app notifications: created server-side (service_role) when a user is set
-- as "Macher" on a task or @-mentioned in a comment. Each user only ever sees
-- and updates their OWN notifications.
-- ============================================================================

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  type       text not null,               -- 'assignment' | 'mention'
  task_id    uuid references tasks (id) on delete cascade,
  board_id   uuid references boards (id) on delete cascade,
  actor_id   uuid references profiles (id) on delete set null,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;
alter table notifications force row level security;

-- Recipients read only their own notifications...
create policy notifications_select on notifications for select to authenticated
  using (user_id = auth.uid());

-- ...and may only mark their own as read (no other columns matter here).
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No INSERT policy: notifications are created only by trusted server code
-- (service_role), never directly by a client.

-- Realtime so the bell updates live.
do $$
begin
  execute 'alter table public.notifications replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;


-- ============================================================================
-- AWOS — 0009 groups
-- A board can hold multiple named groups (e.g. "Social Media", "Content").
-- Tasks belong to a group. Anyone with board access may create/rename/delete
-- groups (customers organize their own board).
-- ============================================================================

create table groups (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards (id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index groups_board_id_idx on groups (board_id);

alter table tasks add column group_id uuid references groups (id) on delete set null;
create index tasks_group_id_idx on tasks (group_id);

alter table groups enable row level security;
alter table groups force row level security;

create policy groups_select on groups for select to authenticated
  using (can_access_board(board_id));

create policy groups_write on groups for all to authenticated
  using (can_access_board(board_id))
  with check (can_access_board(board_id));

-- Backfill: every existing board gets a default group; existing tasks join it.
do $$
declare
  b record;
  g uuid;
begin
  for b in select id from boards loop
    if not exists (select 1 from groups where board_id = b.id) then
      insert into groups (board_id, name, position)
        values (b.id, 'Aufgaben', 0)
        returning id into g;
      update tasks set group_id = g where board_id = b.id and group_id is null;
    end if;
  end loop;
end $$;

-- New boards get a default group too.
create or replace function create_board(
  p_name        text,
  p_type        board_type,
  p_customer_id uuid    default null,
  p_department  department default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_board_id uuid;
begin
  insert into boards (name, type, customer_id, department)
  values (p_name, p_type, p_customer_id, p_department)
  returning id into v_board_id;

  perform seed_default_columns(v_board_id);
  insert into groups (board_id, name, position) values (v_board_id, 'Aufgaben', 0);
  return v_board_id;
end;
$$;

revoke all on function create_board(text, board_type, uuid, department)
  from public, anon, authenticated;
grant execute on function create_board(text, board_type, uuid, department)
  to service_role;

-- Realtime for live group updates.
do $$
begin
  execute 'alter table public.groups replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups'
  ) then
    execute 'alter publication supabase_realtime add table public.groups';
  end if;
end $$;
