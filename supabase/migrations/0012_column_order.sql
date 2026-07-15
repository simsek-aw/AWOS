-- ============================================================================
-- AWOS — 0012 column order & Output label
-- New default order: Task-ID · Name · PM · Macher · Deadline · Output · Status
-- (the "Kunde" column is a display-only column shown on internal boards, not
--  stored here). The OneDrive column is relabeled "Output" (key stays onedrive).
-- ============================================================================

update columns set position = 0                    where key = 'task_id';
update columns set position = 1                    where key = 'name';
update columns set position = 2                    where key = 'pm';
update columns set position = 3                    where key = 'macher';
update columns set position = 4                    where key = 'deadline';
update columns set position = 5, label = 'Output'  where key = 'onedrive';
update columns set position = 6                    where key = 'status';

-- New boards use the same order/labels.
create or replace function seed_default_columns(p_board_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into columns (board_id, key, label, type, position, is_required, options) values
    (p_board_id, 'task_id',  'Task-ID',   'text',   0, false, '{}'::jsonb),
    (p_board_id, 'name',     'Name',      'text',   1, true,  '{}'::jsonb),
    (p_board_id, 'pm',       'PM',        'person', 2, false, '{}'::jsonb),
    (p_board_id, 'macher',   'Macher',    'person', 3, false, '{}'::jsonb),
    (p_board_id, 'deadline', 'Deadline',  'date',   4, false, '{}'::jsonb),
    (p_board_id, 'onedrive', 'Output',    'link',   5, false, '{}'::jsonb),
    (p_board_id, 'status',   'Status',    'status', 6, false,
       jsonb_build_object('options', jsonb_build_array(
         jsonb_build_object('label','Offen',        'color','#9e9e9e'),
         jsonb_build_object('label','In Arbeit',    'color','#fdab3d'),
         jsonb_build_object('label','Review',       'color','#579bfc'),
         jsonb_build_object('label','Fertig',       'color','#00c875')
       )))
  on conflict (board_id, key) do nothing;
end;
$$;

revoke all on function seed_default_columns(uuid) from public, anon, authenticated;
grant execute on function seed_default_columns(uuid) to service_role;
