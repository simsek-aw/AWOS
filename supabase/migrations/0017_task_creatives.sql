-- ============================================================================
-- AWOS — 0017 task_creatives
-- On-demand AI creative ideas for a task (headlines, sublines, CTAs, visual
-- ideas). Employees only; generated on button click, stored so they persist
-- and stream live. Written server-side (service role).
-- ============================================================================

create table if not exists task_creatives (
  task_id    uuid primary key references tasks (id) on delete cascade,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

alter table task_creatives enable row level security;
alter table task_creatives force row level security;

drop policy if exists task_creatives_select on task_creatives;
create policy task_creatives_select on task_creatives for select to authenticated
  using (is_employee());

do $$
begin
  execute 'alter table public.task_creatives replica identity full';
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='task_creatives') then
    execute 'alter publication supabase_realtime add table public.task_creatives';
  end if;
end $$;
