-- Agency-wide on/off switches (and last-run stamps) for the automatic agents.
-- Read/written by employees in the UI; the cron routes and trigger functions
-- read them via the service client (RLS bypassed).
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

-- Only employees may see and change automation settings.
do $$ begin
  create policy automation_settings_select on automation_settings
    for select using (is_employee());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy automation_settings_update on automation_settings
    for update using (is_employee()) with check (is_employee());
exception when duplicate_object then null; end $$;
