-- Per-user read markers for task update threads. Drives the "unread comments"
-- highlight on the board (a task is unread when it has a comment by someone
-- else newer than the user's last_read_at for that task).
create table if not exists task_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table task_reads enable row level security;
alter table task_reads force row level security;

-- A user only ever sees and manages their own read markers.
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
