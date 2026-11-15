-- Audit log, editable settings, recruiter assignments, to-dos, employer logins,
-- worker email + alerts, training providers.

create table if not exists audit_log (
  id text primary key default gen_random_uuid()::text,
  at timestamptz not null default now(),
  actor_role text not null,
  actor text not null,            -- email or demo label
  action text not null,           -- e.g. card.verified, screening.pre_adverse
  entity_type text not null,
  entity_id text not null,
  summary text not null default ''
);
create index if not exists audit_log_at_idx on audit_log(at desc);
create index if not exists audit_log_entity_idx on audit_log(entity_type, entity_id);

create table if not exists app_settings (
  id text primary key,            -- the setting key
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

alter table employers add column if not exists recruiter_id text references team_members(id) on delete set null;

create table if not exists tasks (
  id text primary key default gen_random_uuid()::text,
  owner_id text not null,         -- team_members.id
  title text not null,
  due_on date,
  link text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_owner_idx on tasks(owner_id);

create table if not exists employer_users (
  id text primary key default gen_random_uuid()::text,
  employer_id text not null references employers(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  role text not null default 'hiring_manager' check (role in ('owner','hiring_manager')),
  created_at timestamptz not null default now()
);

alter table workers alter column phone drop not null;
alter table workers add column if not exists email text;
alter table workers add column if not exists alerts text not null default 'sms' check (alerts in ('sms','email','none'));
alter table workers add column if not exists last_seen_at timestamptz;
create unique index if not exists workers_email_idx on workers(lower(email)) where email is not null;

create table if not exists providers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  contact_email text not null unique,
  website text,
  created_at timestamptz not null default now()
);
alter table training_programs add column if not exists provider_id text references providers(id) on delete set null;
alter table training_programs add column if not exists status text not null default 'published' check (status in ('published','pending'));

alter table profiles add column if not exists provider_id text references providers(id) on delete set null;
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('worker','employer','recruiter','admin','provider'));

alter table audit_log enable row level security;
alter table app_settings enable row level security;
alter table tasks enable row level security;
alter table employer_users enable row level security;
alter table providers enable row level security;
grant all on audit_log, app_settings, tasks, employer_users, providers to service_role;
