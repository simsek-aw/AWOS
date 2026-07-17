-- Task templates: reusable task definitions per board, optionally recurring
-- (e.g. a monthly newsletter task created automatically).
create table if not exists task_templates (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards (id) on delete cascade,
  name        text not null,           -- template name (shown in the menu)
  title       text not null,           -- title of the created task
  recurrence  text not null default 'none', -- 'none' | 'weekly' | 'monthly'
  next_run    date,                    -- when the next auto-task is due (recurring)
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists task_templates_board_idx on task_templates (board_id);

alter table task_templates enable row level security;
alter table task_templates force row level security;

-- Internal tool: employees manage templates.
drop policy if exists task_templates_select on task_templates;
create policy task_templates_select on task_templates
  for select to authenticated using (is_employee());
drop policy if exists task_templates_write on task_templates;
create policy task_templates_write on task_templates
  for all to authenticated using (is_employee()) with check (is_employee());
