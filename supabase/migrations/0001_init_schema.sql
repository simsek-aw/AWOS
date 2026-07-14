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
