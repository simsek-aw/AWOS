-- ============================================================================
-- AWOS — 0016 task_suggestions
-- AI triage hint for a customer task: suggested department, priority and a
-- candidate "Macher". Advisory only (the PM still tags manually). Employees
-- only — a customer must never see this. Written server-side (service role).
-- ============================================================================

create table if not exists task_suggestions (
  task_id     uuid primary key references tasks (id) on delete cascade,
  department  text,
  priority    text,
  assignee_id uuid references profiles (id) on delete set null,
  reasoning   text,
  updated_at  timestamptz not null default now()
);

alter table task_suggestions enable row level security;
alter table task_suggestions force row level security;

drop policy if exists task_suggestions_select on task_suggestions;
create policy task_suggestions_select on task_suggestions for select to authenticated
  using (is_employee());

do $$
begin
  execute 'alter table public.task_suggestions replica identity full';
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='task_suggestions') then
    execute 'alter publication supabase_realtime add table public.task_suggestions';
  end if;
end $$;
