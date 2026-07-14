-- ============================================================================
-- AWOS — 0006 policy hardening (security review fixes)
-- ============================================================================

-- FINDING 1 (critical): privilege escalation via self-update of profiles.
-- The profiles_update policy let a user UPDATE their own row with no column
-- restriction, so a customer could set role='employee', customer_id=null and
-- gain access to every board. No app flow updates profiles through a user
-- session (profile writes go through provision_profile / service_role), so we
-- remove client write access to the table entirely and drop the policy.
drop policy if exists profiles_update on profiles;
revoke insert, update, delete on profiles from anon, authenticated;

-- FINDING 2 (medium): comment attribution spoofing. The old insert policy only
-- checked board access, so a customer could insert a comment with is_agent=true
-- or a forged author_id. Require the author to be the caller and is_agent=false.
-- The mirroring agent writes via service_role (bypasses RLS) and is unaffected.
drop policy if exists comments_insert on comments;
create policy comments_insert on comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and is_agent = false
    and exists (
      select 1 from tasks t
      where t.id = comments.task_id and can_access_board(t.board_id)
    )
  );

-- FINDING 4 (low, integrity): a task_value could reference a column from a
-- different board. Require the column to belong to the task's own board.
drop policy if exists task_values_write on task_values;
create policy task_values_write on task_values for all to authenticated
  using (
    exists (
      select 1 from tasks t
      where t.id = task_values.task_id and can_access_board(t.board_id)
    )
  )
  with check (
    exists (
      select 1 from tasks t
      join columns c on c.id = task_values.column_id
      where t.id = task_values.task_id
        and c.board_id = t.board_id
        and can_access_board(t.board_id)
    )
  );
