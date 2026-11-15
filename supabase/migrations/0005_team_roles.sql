-- Separate admin and recruiter personas. Team members are managed in Admin → Team.
create table if not exists team_members (
  id text primary key default gen_random_uuid()::text,
  email text not null unique,
  name text not null default '',
  role text not null check (role in ('admin','recruiter')),
  created_at timestamptz not null default now()
);
alter table team_members enable row level security;
grant all on team_members to service_role;

-- The old shared "staff" role was the owner: make those profiles admins.
alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'admin' where role = 'staff';
alter table profiles add constraint profiles_role_check check (role in ('worker','employer','recruiter','admin'));
