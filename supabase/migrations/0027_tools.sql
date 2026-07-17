-- Tools registry: AWOS as a central platform that ties together the agency's
-- separate internal tools (AWcms, AWscribe, AWstudio, …). Each row is one tool
-- shown in the product switcher next to the logo.
--
-- kind:
--   'internal' — a route inside this app (url is a path like '/my')
--   'link'     — an external tool opened in a new tab (url is an absolute URL)
--   'embed'    — an external tool embedded in an iframe under /tools/[key]
create table if not exists tools (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  icon        text,                       -- emoji or short initials shown on the tile
  color       text,                       -- accent hex for the tile
  kind        text not null default 'link',
  url         text,
  position    int not null default 0,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table tools enable row level security;
alter table tools force row level security;

-- Employees can see the tools; writes go through admin-only server actions
-- (service role), matching how the rest of the admin surface works.
drop policy if exists tools_select on tools;
create policy tools_select on tools
  for select to authenticated
  using (is_employee());

-- Seed the platform's first tools. AWcms is this app; the others are placeholders
-- the team fills in (or renames) from the admin UI.
insert into tools (key, name, description, icon, color, kind, url, position, enabled)
values
  ('awcms', 'AWcms', 'Boards, Aufgaben und Kunden', '🗂️', '#00c875', 'internal', '/boards', 0, true),
  ('awideogram', 'AWideogram', 'Bildgenerierung mit Layout-Kontrolle (Ideogram 4.0)', '🖼️', '#a25ddc', 'internal', '/tools/awideogram', 1, true),
  ('awcompose', 'AWcompose', 'Produktfoto exakt auf einen (KI-)Hintergrund montieren', '🧩', '#2dd4bf', 'internal', '/tools/awcompose', 2, true),
  ('awmeet', 'AWmeet', 'Meetings transkribieren, zusammenfassen und To-Dos ableiten', '🎙️', '#579bfc', 'link', null, 3, false),
  ('awcreative', 'AWcreative', 'Produkte zu einer Bilderserie / Ads generieren', '🎨', '#fdab3d', 'link', null, 4, false),
  ('awtime', 'AWtime', 'Zeiterfassung', '⏱️', '#e2445c', 'link', null, 5, false)
on conflict (key) do nothing;
