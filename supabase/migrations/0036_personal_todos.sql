-- Personal quick to-do / notes list shown on the dashboard. Private per user
-- (RLS: own rows only), independent of board tasks — a lightweight scratchpad.
create table if not exists personal_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists personal_todos_user_idx
  on personal_todos (user_id, done, created_at);

alter table personal_todos enable row level security;
alter table personal_todos force row level security;

do $$ begin
  create policy personal_todos_select on personal_todos
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy personal_todos_insert on personal_todos
    for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy personal_todos_update on personal_todos
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy personal_todos_delete on personal_todos
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
