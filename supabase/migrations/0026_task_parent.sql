-- Subitems (monday-style nested tasks).
--
-- A subitem is just a task with a parent_id pointing at another task on the
-- SAME board. Because subitems keep the parent's board_id, the existing RLS
-- policies (which key off board_id) cover them without any new policy — a user
-- who can see/edit the board can see/edit its subitems, and multi-tenant
-- isolation is preserved.
--
-- ON DELETE CASCADE: deleting a parent removes its subitems (and their values,
-- which already cascade from tasks). Self-reference, so no ordering concerns.
alter table tasks
  add column if not exists parent_id uuid references tasks(id) on delete cascade;

create index if not exists tasks_parent_id_idx on tasks(parent_id);
