-- ============================================================================
-- AWOS — 0009 groups
-- A board can hold multiple named groups (e.g. "Social Media", "Content").
-- Tasks belong to a group. Anyone with board access may create/rename/delete
-- groups (customers organize their own board).
-- ============================================================================

create table groups (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references boards (id) on delete cascade,
  name       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index groups_board_id_idx on groups (board_id);

alter table tasks add column group_id uuid references groups (id) on delete set null;
create index tasks_group_id_idx on tasks (group_id);

alter table groups enable row level security;
alter table groups force row level security;

create policy groups_select on groups for select to authenticated
  using (can_access_board(board_id));

create policy groups_write on groups for all to authenticated
  using (can_access_board(board_id))
  with check (can_access_board(board_id));

-- Backfill: every existing board gets a default group; existing tasks join it.
do $$
declare
  b record;
  g uuid;
begin
  for b in select id from boards loop
    if not exists (select 1 from groups where board_id = b.id) then
      insert into groups (board_id, name, position)
        values (b.id, 'Aufgaben', 0)
        returning id into g;
      update tasks set group_id = g where board_id = b.id and group_id is null;
    end if;
  end loop;
end $$;

-- New boards get a default group too.
create or replace function create_board(
  p_name        text,
  p_type        board_type,
  p_customer_id uuid    default null,
  p_department  department default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_board_id uuid;
begin
  insert into boards (name, type, customer_id, department)
  values (p_name, p_type, p_customer_id, p_department)
  returning id into v_board_id;

  perform seed_default_columns(v_board_id);
  insert into groups (board_id, name, position) values (v_board_id, 'Aufgaben', 0);
  return v_board_id;
end;
$$;

revoke all on function create_board(text, board_type, uuid, department)
  from public, anon, authenticated;
grant execute on function create_board(text, board_type, uuid, department)
  to service_role;

-- Realtime for live group updates.
do $$
begin
  execute 'alter table public.groups replica identity full';
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'groups'
  ) then
    execute 'alter publication supabase_realtime add table public.groups';
  end if;
end $$;
