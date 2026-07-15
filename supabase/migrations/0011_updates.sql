-- ============================================================================
-- AWOS — 0011 updates: comment replies, likes, and a per-task activity log
-- ============================================================================

-- Threaded replies: a comment may answer another comment.
alter table comments add column parent_id uuid references comments (id) on delete cascade;
create index comments_parent_idx on comments (parent_id);

-- Likes on comments.
create table comment_likes (
  comment_id uuid not null references comments (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table comment_likes enable row level security;
alter table comment_likes force row level security;

create policy comment_likes_select on comment_likes for select to authenticated
  using (exists (
    select 1 from comments c join tasks t on t.id = c.task_id
    where c.id = comment_likes.comment_id and can_access_board(t.board_id)
  ));

create policy comment_likes_insert on comment_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from comments c join tasks t on t.id = c.task_id
      where c.id = comment_likes.comment_id and can_access_board(t.board_id)
    )
  );

create policy comment_likes_delete on comment_likes for delete to authenticated
  using (user_id = auth.uid());

-- Per-task activity log. Written server-side (service role); readable by
-- employees only — it's an internal view of what happened on a task.
create table task_events (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks (id) on delete cascade,
  actor_id   uuid references profiles (id) on delete set null,
  kind       text not null,      -- created | renamed | changed | assigned | moved | commented | mirrored
  summary    text not null,
  created_at timestamptz not null default now()
);
create index task_events_task_idx on task_events (task_id, created_at);

alter table task_events enable row level security;
alter table task_events force row level security;

create policy task_events_select on task_events for select to authenticated
  using (is_employee());

-- Realtime for live likes and activity.
do $$
begin
  execute 'alter table public.comment_likes replica identity full';
  execute 'alter table public.task_events replica identity full';
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='comment_likes') then
    execute 'alter publication supabase_realtime add table public.comment_likes';
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='task_events') then
    execute 'alter publication supabase_realtime add table public.task_events';
  end if;
end $$;
