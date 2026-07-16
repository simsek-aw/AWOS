-- Track when a comment was last edited (shows a "bearbeitet" hint).
alter table comments
  add column if not exists edited_at timestamptz;
