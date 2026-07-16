-- Soft-archive for boards: archived boards are hidden from the sidebar and
-- board lists but keep all their data. Rename is just an UPDATE on name.
alter table boards
  add column if not exists archived_at timestamptz;
