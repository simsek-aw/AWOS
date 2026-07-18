-- Let a personal note be tagged with a customer (optional). on delete set null
-- so removing a customer keeps the note (just untags it).
alter table personal_todos
  add column if not exists customer_id uuid references customers(id) on delete set null;

create index if not exists personal_todos_customer_idx
  on personal_todos (customer_id);
