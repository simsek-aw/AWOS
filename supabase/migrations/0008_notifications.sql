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
