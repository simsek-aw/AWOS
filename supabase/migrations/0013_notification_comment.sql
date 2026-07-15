-- ============================================================================
-- AWOS — 0013 notification → comment link
-- Lets a notification point at the exact comment so the UI can open the task
-- and flash that comment.
-- ============================================================================

alter table notifications
  add column if not exists comment_id uuid references comments (id) on delete set null;
