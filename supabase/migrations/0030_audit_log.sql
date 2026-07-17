-- Platform-wide audit log: who did what across AWOS (tools, users, boards,
-- imports, generations …). Written by server actions via the service role;
-- readable only by admins (the admin page reads it through the service client,
-- so no SELECT policy is granted here — RLS denies everyone else).
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles (id) on delete set null,
  action     text not null,          -- e.g. 'tool.create', 'user.invite'
  entity     text,                   -- e.g. 'tool', 'board', 'customer'
  entity_id  text,
  summary    text not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);

alter table audit_log enable row level security;
alter table audit_log force row level security;
-- No policies: only the service role (server actions) can read/write.
