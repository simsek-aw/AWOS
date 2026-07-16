-- Distinguish admins (manage users/boards/customers/team) from regular
-- employees (work on boards only). Additive: role stays employee/customer.
alter table profiles
  add column if not exists is_admin boolean not null default false;

-- Grant admin to the initial owner so nobody is locked out of /admin. Promote
-- further admins from the admin UI afterwards.
update profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and lower(u.email) = 'simsek@absolutweb.de';
