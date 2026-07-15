-- ============================================================================
-- AWOS — 0014 task_summaries
-- A short AI summary of a task's updates/comments, regenerated server-side on
-- each new comment. Readable by anyone who can access the task's board.
-- ============================================================================

create table if not exists task_summaries (
  task_id    uuid primary key references tasks (id) on delete cascade,
  summary    text not null,
  updated_at timestamptz not null default now()
);

alter table task_summaries enable row level security;
alter table task_summaries force row level security;

-- Read if you can access the task's board. Writes are service-role only.
drop policy if exists task_summaries_select on task_summaries;
create policy task_summaries_select on task_summaries for select to authenticated
  using (exists (
    select 1 from tasks t
    where t.id = task_summaries.task_id and can_access_board(t.board_id)
  ));

do $$
begin
  execute 'alter table public.task_summaries replica identity full';
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='task_summaries') then
    execute 'alter publication supabase_realtime add table public.task_summaries';
  end if;
end $$;
