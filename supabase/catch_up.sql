-- ============================================================================
-- AWOS — idempotent catch-up (migrations 0008–0012)
-- Safe to run any number of times: every statement guards its own existence.
-- Run this in the Supabase SQL editor to bring a partially-migrated database
-- up to date. Requires 0001–0007 (customers, boards, tasks, comments,
-- attachments, RLS helpers) to already exist.
-- ============================================================================

-- ---- 0008 notifications ----------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  type       text not null,
  task_id    uuid references tasks (id) on delete cascade,
  board_id   uuid references boards (id) on delete cascade,
  actor_id   uuid references profiles (id) on delete set null,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read, created_at desc);
alter table notifications enable row level security;
alter table notifications force row level security;
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- 0009 groups -----------------------------------------------------------
create table if not exists groups (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards (id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists groups_board_id_idx on groups (board_id);
alter table tasks add column if not exists group_id uuid references groups (id) on delete set null;
create index if not exists tasks_group_id_idx on tasks (group_id);
alter table groups enable row level security;
alter table groups force row level security;
drop policy if exists groups_select on groups;
create policy groups_select on groups for select to authenticated
  using (can_access_board(board_id));
drop policy if exists groups_write on groups;
create policy groups_write on groups for all to authenticated
  using (can_access_board(board_id)) with check (can_access_board(board_id));
-- backfill a default group per board
do $$
declare b record; g uuid;
begin
  for b in select id from boards loop
    if not exists (select 1 from groups where board_id = b.id) then
      insert into groups (board_id, name, position) values (b.id, 'Aufgaben', 0)
        returning id into g;
      update tasks set group_id = g where board_id = b.id and group_id is null;
    end if;
  end loop;
end $$;

-- ---- 0010 mirror release + per-department links ----------------------------
alter table comments   add column if not exists released_at timestamptz;
alter table task_links add column if not exists internal_board_id uuid references boards (id) on delete cascade;
update task_links set internal_board_id = t.board_id
  from tasks t
  where t.id = task_links.internal_task_id and task_links.internal_board_id is null;
create unique index if not exists task_links_customer_board_uidx
  on task_links (customer_task_id, internal_board_id);

-- ---- 0011 replies, likes, activity log -------------------------------------
alter table comments add column if not exists parent_id uuid references comments (id) on delete cascade;
create index if not exists comments_parent_idx on comments (parent_id);

create table if not exists comment_likes (
  comment_id uuid not null references comments (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table comment_likes enable row level security;
alter table comment_likes force row level security;
drop policy if exists comment_likes_select on comment_likes;
create policy comment_likes_select on comment_likes for select to authenticated
  using (exists (select 1 from comments c join tasks t on t.id = c.task_id
                 where c.id = comment_likes.comment_id and can_access_board(t.board_id)));
drop policy if exists comment_likes_insert on comment_likes;
create policy comment_likes_insert on comment_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from comments c join tasks t on t.id = c.task_id
    where c.id = comment_likes.comment_id and can_access_board(t.board_id)));
drop policy if exists comment_likes_delete on comment_likes;
create policy comment_likes_delete on comment_likes for delete to authenticated
  using (user_id = auth.uid());

create table if not exists task_events (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks (id) on delete cascade,
  actor_id   uuid references profiles (id) on delete set null,
  kind       text not null,
  summary    text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_events_task_idx on task_events (task_id, created_at);
alter table task_events enable row level security;
alter table task_events force row level security;
drop policy if exists task_events_select on task_events;
create policy task_events_select on task_events for select to authenticated
  using (is_employee());

-- ---- 0012 column order + Output label --------------------------------------
update columns set position = 0                    where key = 'task_id';
update columns set position = 1                    where key = 'name';
update columns set position = 2                    where key = 'pm';
update columns set position = 3                    where key = 'macher';
update columns set position = 4                    where key = 'deadline';
update columns set position = 5, label = 'Output'  where key = 'onedrive';
update columns set position = 6                    where key = 'status';

-- Latest seed_default_columns (new order + Output) and create_board (seeds a group).
create or replace function seed_default_columns(p_board_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into columns (board_id, key, label, type, position, is_required, options) values
    (p_board_id, 'task_id',  'Task-ID',   'text',   0, false, '{}'::jsonb),
    (p_board_id, 'name',     'Name',      'text',   1, true,  '{}'::jsonb),
    (p_board_id, 'pm',       'PM',        'person', 2, false, '{}'::jsonb),
    (p_board_id, 'macher',   'Macher',    'person', 3, false, '{}'::jsonb),
    (p_board_id, 'deadline', 'Deadline',  'date',   4, false, '{}'::jsonb),
    (p_board_id, 'onedrive', 'Output',    'link',   5, false, '{}'::jsonb),
    (p_board_id, 'status',   'Status',    'status', 6, false,
       jsonb_build_object('options', jsonb_build_array(
         jsonb_build_object('label','Offen',     'color','#9e9e9e'),
         jsonb_build_object('label','In Arbeit', 'color','#fdab3d'),
         jsonb_build_object('label','Review',    'color','#579bfc'),
         jsonb_build_object('label','Fertig',    'color','#00c875')
       )))
  on conflict (board_id, key) do nothing;
end; $$;

create or replace function create_board(
  p_name text, p_type board_type, p_customer_id uuid default null, p_department department default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_board_id uuid;
begin
  insert into boards (name, type, customer_id, department)
  values (p_name, p_type, p_customer_id, p_department) returning id into v_board_id;
  perform seed_default_columns(v_board_id);
  insert into groups (board_id, name, position) values (v_board_id, 'Aufgaben', 0);
  return v_board_id;
end; $$;
revoke all on function create_board(text, board_type, uuid, department) from public, anon, authenticated;
grant execute on function create_board(text, board_type, uuid, department) to service_role;
revoke all on function seed_default_columns(uuid) from public, anon, authenticated;
grant execute on function seed_default_columns(uuid) to service_role;

-- ---- realtime publication --------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['notifications','groups','comment_likes','task_events'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ---- 0013 notification comment link ----
alter table notifications add column if not exists comment_id uuid references comments (id) on delete set null;


-- ---- 0014 task_summaries ----
create table if not exists task_summaries (
  task_id uuid primary key references tasks (id) on delete cascade,
  summary text not null,
  updated_at timestamptz not null default now()
);
alter table task_summaries enable row level security;
alter table task_summaries force row level security;
drop policy if exists task_summaries_select on task_summaries;
create policy task_summaries_select on task_summaries for select to authenticated
  using (exists (select 1 from tasks t where t.id = task_summaries.task_id and can_access_board(t.board_id)));
do $$ begin
  execute 'alter table public.task_summaries replica identity full';
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='task_summaries') then
    execute 'alter publication supabase_realtime add table public.task_summaries'; end if;
end $$;


-- ---- 0015 automations ----
create table if not exists task_reminders (
  task_id uuid not null references tasks (id) on delete cascade,
  kind text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  primary key (task_id, kind)
);
alter table task_reminders enable row level security;
alter table task_reminders force row level security;
alter table tasks add column if not exists archived_at timestamptz;
create index if not exists tasks_archived_idx on tasks (board_id, archived_at);


-- ---- 0016 task_suggestions ----
create table if not exists task_suggestions (
  task_id uuid primary key references tasks (id) on delete cascade,
  department text,
  priority text,
  assignee_id uuid references profiles (id) on delete set null,
  reasoning text,
  updated_at timestamptz not null default now()
);
alter table task_suggestions enable row level security;
alter table task_suggestions force row level security;
drop policy if exists task_suggestions_select on task_suggestions;
create policy task_suggestions_select on task_suggestions for select to authenticated using (is_employee());
do $$ begin
  execute 'alter table public.task_suggestions replica identity full';
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='task_suggestions') then
    execute 'alter publication supabase_realtime add table public.task_suggestions'; end if;
end $$;


-- ---- 0017 task_creatives ----
create table if not exists task_creatives (
  task_id uuid primary key references tasks (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table task_creatives enable row level security;
alter table task_creatives force row level security;
drop policy if exists task_creatives_select on task_creatives;
create policy task_creatives_select on task_creatives for select to authenticated using (is_employee());
do $$ begin
  execute 'alter table public.task_creatives replica identity full';
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='task_creatives') then
    execute 'alter publication supabase_realtime add table public.task_creatives'; end if;
end $$;
