-- Manual customer tag for internally-created tasks (monday-style label).
--
-- Purely organisational: setting it NEVER creates a mirror or syncs anything to
-- the customer's board. A task created on an internal board always stays
-- internal; this column only records which customer it relates to so the team
-- can organise/filter internal work. Mirrored tasks ignore this column and
-- derive their customer from task_links instead.
alter table tasks
  add column if not exists customer_id uuid references customers(id) on delete set null;

create index if not exists tasks_customer_id_idx on tasks(customer_id);
