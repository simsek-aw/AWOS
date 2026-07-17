-- Tools: per-tool visibility + status.
--
-- visibility:
--   'all'        — every employee sees it (default)
--   'admins'     — admins only
--   'marketing' | 'content' | 'grafik' — that department (+ admins)
-- status:
--   'active'      — normal
--   'maintenance' — shown but greyed out with a "Wartung" badge
alter table tools
  add column if not exists visibility text not null default 'all';
alter table tools
  add column if not exists status text not null default 'active';
