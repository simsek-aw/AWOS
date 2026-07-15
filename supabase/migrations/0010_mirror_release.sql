-- ============================================================================
-- AWOS — 0010 mirror redesign: per-comment release marker
-- The mirror agent now routes a customer task into one internal board PER
-- department of the tagged PM/Macher. All linked tasks (customer + internal
-- copies) share ONE comment thread on the internal side (assembled at read
-- time via task_links — no schema change needed for that).
--
-- The only new persistent state is `released_at`: when an employee releases a
-- single internal comment to the customer, the SOURCE comment is stamped so
-- the button flips to "already sent" and it can't be released twice.
-- ============================================================================

alter table comments add column released_at timestamptz;

-- (No new RLS: comments_modify already lets employees update comments, and the
--  customer-visible copy is inserted under comments_insert like any comment.)

-- A customer task may now be mirrored into MULTIPLE internal boards (one per
-- department). Record which board each link targets and forbid two copies of
-- the same customer task in the same board — this closes the race where two
-- concurrent syncs would each create a duplicate copy (the losing INSERT fails
-- and the caller removes its orphaned task).
alter table task_links add column internal_board_id uuid references boards (id) on delete cascade;

update task_links
  set internal_board_id = t.board_id
  from tasks t
  where t.id = task_links.internal_task_id
    and task_links.internal_board_id is null;

create unique index if not exists task_links_customer_board_uidx
  on task_links (customer_task_id, internal_board_id);
