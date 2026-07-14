-- ============================================================================
-- AWOS — 0004 lock down privileged helper functions
--
-- provision_profile / create_board / seed_default_columns are SECURITY DEFINER:
-- they run with owner rights and bypass RLS. Postgres grants EXECUTE to PUBLIC
-- by default, and Supabase exposes public functions as PostgREST RPC — so
-- WITHOUT this migration, any authenticated user (including a customer) could
-- call provision_profile to promote themselves to 'employee', or create_board
-- to spawn boards. These must be callable ONLY by trusted server code.
-- ============================================================================

revoke all on function provision_profile(uuid, text, user_role, uuid, department)
  from public, anon, authenticated;
revoke all on function create_board(text, board_type, uuid, department)
  from public, anon, authenticated;
revoke all on function seed_default_columns(uuid)
  from public, anon, authenticated;

-- service_role (used only by server-side code) keeps access.
grant execute on function provision_profile(uuid, text, user_role, uuid, department)
  to service_role;
grant execute on function create_board(text, board_type, uuid, department)
  to service_role;
grant execute on function seed_default_columns(uuid)
  to service_role;

-- The read-only helpers used inside RLS policies stay executable for
-- authenticated users — they only ever read the caller's own row and grant no
-- privilege on their own.
