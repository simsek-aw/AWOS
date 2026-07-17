-- Sidebar unread badges in one query instead of pulling every task + comment +
-- read-marker into the app layout on every navigation.
--
-- A task counts as unread for a board when someone else commented after the
-- user last opened it. SECURITY INVOKER so the caller's RLS still applies —
-- users only ever get counts for boards they can access.
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
    and (r.last_read_at is null or r.last_read_at < c.created_at)
  group by t.board_id;
$$;

grant execute on function unread_counts() to authenticated;
