-- Per-user favorited boards. Drives the "Favoriten" section on the dashboard
-- and the pinned group at the top of the AWcms sidebar. A user only ever sees
-- and manages their own favorites (same pattern as task_reads).
create table if not exists board_favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, board_id)
);

alter table board_favorites enable row level security;
alter table board_favorites force row level security;

do $$ begin
  create policy board_favorites_select on board_favorites
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy board_favorites_insert on board_favorites
    for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy board_favorites_delete on board_favorites
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
