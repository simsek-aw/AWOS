-- Saved filter/sort views per user, per board. Each user keeps their own set;
-- config holds the toolbar state (search, person, deadline, groups, sort).
create table if not exists board_views (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  name       text not null,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists board_views_board_user_idx
  on board_views (board_id, user_id);

alter table board_views enable row level security;
alter table board_views force row level security;

-- Each user only sees and manages their own views (and only on boards they can
-- access).
do $$ begin
  create policy board_views_select on board_views
    for select using (user_id = auth.uid() and can_access_board(board_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy board_views_insert on board_views
    for insert with check (user_id = auth.uid() and can_access_board(board_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy board_views_update on board_views
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy board_views_delete on board_views
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
