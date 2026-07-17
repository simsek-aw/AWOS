-- AWhr: recruiting + vacation. Sensitive data — RLS is enabled and FORCED with
-- NO policies, so only the service role (access-checked server actions) can read
-- or write. Access rules (admins/HR see all; per-applicant reviewers; employees
-- see their own vacation) are enforced in the AWhr server actions.

create table if not exists hr_applicants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  position    text,
  stage       text not null default 'Eingegangen',
  cv_url      text,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists hr_applicant_reviewers (
  applicant_id uuid not null references hr_applicants (id) on delete cascade,
  user_id      uuid not null references profiles (id) on delete cascade,
  primary key (applicant_id, user_id)
);

create table if not exists hr_votes (
  applicant_id uuid not null references hr_applicants (id) on delete cascade,
  user_id      uuid not null references profiles (id) on delete cascade,
  value        int not null,             -- 1 (👍) or -1 (👎)
  created_at   timestamptz not null default now(),
  primary key (applicant_id, user_id)
);

create table if not exists hr_notes (
  id           uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references hr_applicants (id) on delete cascade,
  author_id    uuid references profiles (id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create table if not exists vacation_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  substitute_id uuid references profiles (id) on delete set null,
  reason        text,
  status        text not null default 'pending', -- pending | approved | rejected
  decided_by    uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists vacation_user_idx on vacation_requests (user_id);
create index if not exists vacation_range_idx on vacation_requests (start_date, end_date);

do $$
declare t text;
begin
  foreach t in array array[
    'hr_applicants','hr_applicant_reviewers','hr_votes','hr_notes','vacation_requests'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;
-- No policies on purpose: service-role-only.
