-- ============================================================================
-- AWOS — 0015 automations
-- Support for scheduled automations (deadline reminders, overdue escalation,
-- stale nudges, auto-archive). All writes happen server-side via the cron
-- route using the service role, so no client policies are needed.
-- ============================================================================

-- Dedup marker: which reminder of a given kind was already sent for a task.
-- `ref` is a per-kind key (the deadline value, or a staleness week bucket) so a
-- reminder fires again when the underlying value changes.
create table if not exists task_reminders (
  task_id    uuid not null references tasks (id) on delete cascade,
  kind       text not null,           -- due_soon | overdue | stale
  ref        text not null,
  created_at timestamptz not null default now(),
  primary key (task_id, kind)
);
alter table task_reminders enable row level security;
alter table task_reminders force row level security;
-- No policies: only the service role (cron) touches this table.

-- Soft archive: archived tasks are hidden from boards.
alter table tasks add column if not exists archived_at timestamptz;
create index if not exists tasks_archived_idx on tasks (board_id, archived_at);
