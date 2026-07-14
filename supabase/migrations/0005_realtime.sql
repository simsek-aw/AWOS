-- ============================================================================
-- AWOS — 0005 Realtime
-- Publish tasks / task_values / comments to the Supabase Realtime publication
-- so boards update live. Realtime respects RLS: each subscriber only receives
-- change events for rows they are allowed to read (same policies as 0002).
--
-- REPLICA IDENTITY FULL ensures UPDATE/DELETE events carry the full old row so
-- Realtime can apply RLS to them (otherwise only the primary key is sent).
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'task_values', 'comments'] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
