-- ============================================================================
-- AWOS — 0003 helper functions & default columns
-- Server-side helpers for provisioning users and seeding a board's standard
-- columns. These are SECURITY DEFINER and meant to be called from trusted
-- server code (service_role), not directly by the browser client.
-- ============================================================================

-- Seed the standard AWOS columns for a freshly created board:
-- Task-ID, Name, PM, Macher, Status, Deadline, OneDrive (optional).
create or replace function seed_default_columns(p_board_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into columns (board_id, key, label, type, position, is_required, options) values
    (p_board_id, 'task_id',  'Task-ID',   'text',   0, false, '{}'::jsonb),
    (p_board_id, 'name',     'Name',      'text',   1, true,  '{}'::jsonb),
    (p_board_id, 'pm',       'PM',        'person', 2, false, '{}'::jsonb),
    (p_board_id, 'macher',   'Macher',    'person', 3, false, '{}'::jsonb),
    (p_board_id, 'status',   'Status',    'status', 4, false,
       jsonb_build_object('options', jsonb_build_array(
         jsonb_build_object('label','Offen',        'color','#9e9e9e'),
         jsonb_build_object('label','In Arbeit',    'color','#fdab3d'),
         jsonb_build_object('label','Review',       'color','#579bfc'),
         jsonb_build_object('label','Fertig',       'color','#00c875')
       ))),
    (p_board_id, 'deadline', 'Deadline',  'date',   5, false, '{}'::jsonb),
    (p_board_id, 'onedrive', 'OneDrive',  'link',   6, false, '{}'::jsonb)
  on conflict (board_id, key) do nothing;
end;
$$;

-- Create a board and seed its default columns in one call.
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
  return v_board_id;
end;
$$;

-- Provision (or update) a user's profile after they are invited/signed up.
-- Enforces the role/customer_id shape from the schema.
create or replace function provision_profile(
  p_user_id     uuid,
  p_full_name   text,
  p_role        user_role,
  p_customer_id uuid       default null,
  p_department  department  default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role, customer_id, department)
  values (p_user_id, p_full_name, p_role,
          case when p_role = 'customer' then p_customer_id else null end,
          case when p_role = 'employee' then p_department else null end)
  on conflict (id) do update
    set full_name   = excluded.full_name,
        role        = excluded.role,
        customer_id = excluded.customer_id,
        department  = excluded.department;
end;
$$;
