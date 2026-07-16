-- ============================================================================
-- AWOS catch-up: migrations 0018–0024 combined, idempotent.
-- Paste this whole block into the Supabase SQL editor and run once.
-- Safe to re-run (uses IF NOT EXISTS / duplicate_object guards).
-- ============================================================================

-- 0018 — manual customer tag for internally-created tasks -------------------
alter table tasks
  add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists tasks_customer_id_idx on tasks(customer_id);

-- 0019 — per-user read markers (unread-comment highlight) --------------------
create table if not exists task_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
alter table task_reads enable row level security;
alter table task_reads force row level security;
do $$ begin
  create policy task_reads_select on task_reads
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy task_reads_insert on task_reads
    for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy task_reads_update on task_reads
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 0020 — saved filter/sort views per user ------------------------------------
create table if not exists board_views (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  name       text not null,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists board_views_board_user_idx
  on board_views (board_id, user_id);
alter table board_views enable row level security;
alter table board_views force row level security;
do $$ begin
  create policy board_views_select on board_views
    for select using (user_id = auth.uid() and can_access_board(board_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy board_views_insert on board_views
    for insert with check (user_id = auth.uid() and can_access_board(board_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy board_views_update on board_views
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy board_views_delete on board_views
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 0021 — automation on/off switches ------------------------------------------
create table if not exists automation_settings (
  key         text primary key,
  enabled     boolean not null default true,
  last_run_at timestamptz,
  updated_at  timestamptz not null default now()
);
insert into automation_settings (key) values
  ('mirror'), ('triage'), ('reply'), ('reminders'), ('digest')
on conflict (key) do nothing;
alter table automation_settings enable row level security;
alter table automation_settings force row level security;
do $$ begin
  create policy automation_settings_select on automation_settings
    for select using (is_employee());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy automation_settings_update on automation_settings
    for update using (is_employee()) with check (is_employee());
exception when duplicate_object then null; end $$;

-- 0022 — saved agent chats ---------------------------------------------------
create table if not exists agent_chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  agent      text not null,
  title      text,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_chats_user_agent_idx
  on agent_chats (user_id, agent, updated_at desc);
alter table agent_chats enable row level security;
alter table agent_chats force row level security;
do $$ begin
  create policy agent_chats_select on agent_chats
    for select using (user_id = auth.uid() and is_employee());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy agent_chats_insert on agent_chats
    for insert with check (user_id = auth.uid() and is_employee());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy agent_chats_update on agent_chats
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy agent_chats_delete on agent_chats
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 0023 — soft-archive for boards ---------------------------------------------
alter table boards
  add column if not exists archived_at timestamptz;

-- 0024 — comment edited marker -----------------------------------------------
alter table comments
  add column if not exists edited_at timestamptz;
