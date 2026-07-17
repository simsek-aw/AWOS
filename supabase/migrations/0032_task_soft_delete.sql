-- Soft-delete for tasks: deleting moves a task to the trash (deleted_at set)
-- instead of destroying it, so it can be restored. A separate concept from
-- archived_at (which hides completed work but isn't "deleted").
alter table tasks
  add column if not exists deleted_at timestamptz;

create index if not exists tasks_deleted_at_idx on tasks (deleted_at);

-- Unread badges must ignore trashed tasks too.
create or replace function unread_counts()
returns table (board_id uuid, cnt bigint)
language sql
stable
security invoker
as $$
  select t.board_id, count(distinct t.id)::bigint as cnt
  from tasks t
  join comments c
    on c.task_id = t.id
   and c.author_id is not null
   and c.author_id <> auth.uid()
  left join task_reads r
    on r.task_id = t.id
   and r.user_id = auth.uid()
  where t.archived_at is null
    and t.deleted_at is null
    and (r.last_read_at is null or r.last_read_at < c.created_at)
  group by t.board_id;
$$;

grant execute on function unread_counts() to authenticated;
