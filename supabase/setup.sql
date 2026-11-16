-- One-paste setup for the Supabase SQL editor: 0001_init.sql + 0002_rate_limits.sql
-- CrewPass schema. Column names are the snake_case form of the TypeScript fields in lib/types.ts.
-- The Next.js server talks to these tables with the service-role key (lib/db/supabase.ts) and enforces
-- authorization in app code (lib/session.ts). RLS is still ON for every table so that the anon/public
-- key can read nothing unless a policy below allows it.

create extension if not exists pgcrypto;

create table if not exists workers (
  id text primary key default gen_random_uuid()::text,
  phone text not null unique,
  name text not null default '',
  lang text not null default 'en' check (lang in ('en','es')),
  zip text,
  radius_miles int not null default 30,
  shifts text[] not null default '{}',
  trade text,
  years_experience numeric,
  nccer_level int not null default 0 check (nccer_level between 0 and 4),
  skills text[] not null default '{}',
  summary text not null default '',
  consent_sms boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists credentials (
  id text primary key default gen_random_uuid()::text,
  worker_id text not null references workers(id) on delete cascade,
  type text not null,
  number text,
  holder_name text,
  issued_on date,
  expires_on date,
  photo_path text,
  verification text not null default 'self' check (verification in ('self','document','verified')),
  verified_by text,
  verified_method text,
  extraction_confidence numeric,
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists credentials_worker_idx on credentials(worker_id);
create index if not exists credentials_expiry_idx on credentials(expires_on);

create table if not exists employers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  zip text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key default gen_random_uuid()::text,
  employer_id text not null references employers(id) on delete cascade,
  title text not null,
  trade text not null,
  required_credentials text[] not null default '{}',
  preferred_credentials text[] not null default '{}',
  required_skills text[] not null default '{}',
  min_nccer_level int not null default 0,
  min_years numeric not null default 0,
  pay_min numeric not null default 0,
  pay_max numeric not null default 0,
  shift text not null default 'day' check (shift in ('day','night','rotating','turnaround')),
  zip text not null,
  start_date date not null,
  headcount int not null default 1,
  placement_fee numeric not null default 3000,
  status text not null default 'open' check (status in ('open','filled','closed')),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references jobs(id) on delete cascade,
  worker_id text not null references workers(id) on delete cascade,
  stage text not null check (stage in ('shortlisted','sent','interview','hired','rejected')),
  score int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, worker_id)
);

create table if not exists placements (
  id text primary key default gen_random_uuid()::text,
  match_id text not null references matches(id),
  job_id text not null references jobs(id),
  worker_id text not null references workers(id),
  employer_id text not null references employers(id),
  start_date date not null,
  day30_date date not null,
  guarantee_ends_on date not null,
  fee numeric not null,
  status text not null check (status in ('active','day30_confirmed','invoiced','paid','left_early','replaced')),
  invoice_id text,
  invoice_url text,
  created_at timestamptz not null default now()
);

create table if not exists training_programs (
  id text primary key default gen_random_uuid()::text,
  provider text not null,
  name text not null,
  trade text,
  covers_credentials text[] not null default '{}',
  covers_skills text[] not null default '{}',
  nccer_level int,
  city text not null default '',
  zip text not null default '',
  next_start date,
  weeks numeric,
  clock_hours numeric,
  cost_usd numeric,
  funding text[] not null default '{}',
  languages text[] not null default '{en}',
  url text,
  sample boolean not null default false
);

create table if not exists onboarding_sessions (
  id text primary key default gen_random_uuid()::text,
  channel text not null check (channel in ('web','sms','whatsapp','voice')),
  address text not null,
  worker_id text references workers(id) on delete set null,
  step text not null,
  lang text not null default 'en',
  answers jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (channel, address)
);

create table if not exists outbox (
  id text primary key default gen_random_uuid()::text,
  "to" text not null,
  body text not null,
  channel text not null default 'sms',
  status text not null,
  provider_id text,
  created_at timestamptz not null default now()
);

-- Who a signed-in Supabase Auth user is in this app.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('worker','employer','staff')),
  worker_id text references workers(id) on delete set null,
  employer_id text references employers(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table workers enable row level security;
alter table credentials enable row level security;
alter table employers enable row level security;
alter table jobs enable row level security;
alter table matches enable row level security;
alter table placements enable row level security;
alter table training_programs enable row level security;
alter table onboarding_sessions enable row level security;
alter table outbox enable row level security;
alter table profiles enable row level security;

-- Public read of the training directory only. Everything else goes through the server.
drop policy if exists "training is public" on training_programs;
create policy "training is public" on training_programs for select using (true);

drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);

-- Private bucket for credential photos (contains PII: names, card numbers, sometimes DOB).
insert into storage.buckets (id, name, public)
values ('credentials', 'credentials', false)
on conflict (id) do nothing;

-- Fixed-window rate limiting shared by every serverless instance.
create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;

-- Returns true if this hit is allowed. Old windows are pruned opportunistically.
create or replace function rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c int;
begin
  insert into rate_limits(key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_max;
end;
$$;

revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;

-- Server access (service role) to every app table, whatever the project's auto-expose setting.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant select on training_programs to anon, authenticated;
-- Exact coordinates (optional). When null, the app falls back to the ZIP's Census centroid.
alter table workers add column if not exists lat double precision;
alter table workers add column if not exists lng double precision;
alter table jobs add column if not exists lat double precision;
alter table jobs add column if not exists lng double precision;
alter table training_programs add column if not exists lat double precision;
alter table training_programs add column if not exists lng double precision;

-- Training programs: keep requirements current.
alter table training_programs add column if not exists requirement_note text;
alter table training_programs add column if not exists reviewed_on date;
-- Background checks and drug screens. Outcome and dates only; reports stay with the provider.
alter table jobs add column if not exists requires_background boolean not null default false;
alter table jobs add column if not exists requires_drug boolean not null default false;

create table if not exists screenings (
  id text primary key default gen_random_uuid()::text,
  worker_id text not null references workers(id) on delete cascade,
  employer_id text not null references employers(id) on delete cascade,
  job_id text not null references jobs(id) on delete cascade,
  match_id text references matches(id) on delete set null,
  kind text not null check (kind in ('background','drug')),
  provider text not null default 'manual' check (provider in ('manual','checkr')),
  provider_ref text,
  consent_url text,
  status text not null check (status in ('awaiting_consent','in_progress','clear','needs_review','pre_adverse','not_cleared','canceled')),
  consent_at timestamptz,
  consent_name text,
  ordered_at timestamptz,
  completed_at timestamptz,
  expires_on date,
  reviewed_note text,
  pre_adverse_at timestamptz,
  report_copy_sent boolean not null default false,
  final_adverse_at timestamptz,
  price_usd numeric not null default 0,
  invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists screenings_worker_idx on screenings(worker_id);
create index if not exists screenings_provider_ref_idx on screenings(provider_ref);
alter table screenings enable row level security;
grant all on screenings to service_role;
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
-- Admin is founder-only (ADMIN_EMAILS / STAFF_EMAILS). Team rows are recruiters.
update team_members set role = 'recruiter' where role <> 'recruiter';
alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check check (role = 'recruiter');

-- ===== 0008_sectors_temp_crews.sql =====
-- Construction, warehouse and residential work; temp crews with timesheets and payroll; fast pay;
-- ratings, reliability and crew rosters; skills tests; benefits; interview scheduling; ATS webhooks;
-- pay comparison. Safe to re-run.

alter table employers add column if not exists sector text check (sector in ('industrial','construction','warehouse','residential'));
alter table employers add column if not exists ats_webhook_url text;
alter table employers add column if not exists ats_webhook_secret text;

alter table jobs add column if not exists sector text not null default 'industrial' check (sector in ('industrial','construction','warehouse','residential'));
alter table jobs add column if not exists hire_type text not null default 'direct' check (hire_type in ('direct','temp'));
alter table jobs add column if not exists per_diem numeric;
alter table jobs add column if not exists end_date date;
alter table jobs add column if not exists work_order text;

alter table workers add column if not exists payout_speed text not null default 'weekly' check (payout_speed in ('weekly','next_day','instant'));
alter table workers add column if not exists payroll_status text not null default 'not_started' check (payroll_status in ('not_started','invited','ready'));

create table if not exists assignments (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references jobs(id) on delete cascade,
  worker_id text not null references workers(id) on delete cascade,
  employer_id text not null references employers(id) on delete cascade,
  match_id text references matches(id) on delete set null,
  start_date date not null,
  end_date date,
  pay_rate numeric not null,
  bill_rate numeric not null,
  per_diem numeric not null default 0,
  work_order text,
  status text not null default 'active' check (status in ('active','ended','canceled')),
  ended_reason text,
  created_at timestamptz not null default now()
);
create index if not exists assignments_worker_idx on assignments(worker_id);
create index if not exists assignments_employer_idx on assignments(employer_id);

create table if not exists timesheets (
  id text primary key default gen_random_uuid()::text,
  assignment_id text not null references assignments(id) on delete cascade,
  worker_id text not null references workers(id) on delete cascade,
  employer_id text not null references employers(id) on delete cascade,
  job_id text not null references jobs(id) on delete cascade,
  date date not null,
  clock_in text,
  clock_out text,
  break_minutes int not null default 0,
  hours numeric not null default 0,
  attendance text not null default 'worked' check (attendance in ('worked','late','no_show','called_off')),
  per_diem boolean not null default false,
  status text not null default 'open' check (status in ('open','submitted','approved','disputed')),
  note text not null default '',
  approved_by text,
  approved_at timestamptz,
  pay_run_id text,
  payout_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, date)
);
create index if not exists timesheets_worker_idx on timesheets(worker_id, date);
create index if not exists timesheets_employer_idx on timesheets(employer_id, status);

create table if not exists pay_runs (
  id text primary key default gen_random_uuid()::text,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','approved','paid')),
  lines jsonb not null default '[]',
  invoices jsonb not null default '[]',
  timesheet_ids text[] not null default '{}',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);

create table if not exists payouts (
  id text primary key default gen_random_uuid()::text,
  worker_id text not null references workers(id) on delete cascade,
  timesheet_id text not null references timesheets(id) on delete cascade,
  amount numeric not null,
  speed text not null check (speed in ('next_day','instant')),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_ref text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (timesheet_id)
);

create table if not exists ratings (
  id text primary key default gen_random_uuid()::text,
  worker_id text not null references workers(id) on delete cascade,
  employer_id text not null references employers(id) on delete cascade,
  job_id text not null references jobs(id) on delete cascade,
  assignment_id text references assignments(id) on delete set null,
  placement_id text references placements(id) on delete set null,
  quality int not null check (quality between 1 and 5),
  safety int not null check (safety between 1 and 5),
  rehire boolean not null default false,
  comment text not null default '',
  by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ratings_worker_idx on ratings(worker_id);

create table if not exists crew_roster (
  id text primary key default gen_random_uuid()::text,
  employer_id text not null references employers(id) on delete cascade,
  worker_id text not null references workers(id) on delete cascade,
  note text not null default '',
  added_by text not null default '',
  created_at timestamptz not null default now(),
  unique (employer_id, worker_id)
);

create table if not exists assessment_attempts (
  id text primary key default gen_random_uuid()::text,
  worker_id text not null references workers(id) on delete cascade,
  assessment_id text not null,
  kind text not null check (kind in ('knowledge','hands_on')),
  question_ids text[] not null default '{}',
  answers int[],
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score int,
  passed boolean,
  proctored boolean not null default false,
  assessor text,
  note text
);
create index if not exists assessment_attempts_worker_idx on assessment_attempts(worker_id);

create table if not exists benefit_plans (
  id text primary key default gen_random_uuid()::text,
  kind text not null,
  name text not null,
  carrier text not null default '',
  status text not null default 'planned' check (status in ('active','planned')),
  eligibility text not null default '',
  worker_cost text not null default '',
  url text,
  created_at timestamptz not null default now()
);

create table if not exists interviews (
  id text primary key default gen_random_uuid()::text,
  match_id text not null references matches(id) on delete cascade,
  job_id text not null references jobs(id) on delete cascade,
  worker_id text not null references workers(id) on delete cascade,
  employer_id text not null references employers(id) on delete cascade,
  slots text[] not null default '{}',
  chosen_slot text,
  mode text not null default 'in_person' check (mode in ('in_person','phone','video')),
  location text not null default '',
  status text not null default 'proposed' check (status in ('proposed','booked','canceled')),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interviews_worker_idx on interviews(worker_id);

create table if not exists pay_reports (
  id text primary key default gen_random_uuid()::text,
  worker_id text references workers(id) on delete set null,
  trade text not null,
  zip text not null,
  hourly numeric not null check (hourly between 7.25 and 150),
  created_at timestamptz not null default now()
);

alter table assignments enable row level security;
alter table timesheets enable row level security;
alter table pay_runs enable row level security;
alter table payouts enable row level security;
alter table ratings enable row level security;
alter table crew_roster enable row level security;
alter table assessment_attempts enable row level security;
alter table benefit_plans enable row level security;
alter table interviews enable row level security;
alter table pay_reports enable row level security;
grant all on assignments, timesheets, pay_runs, payouts, ratings, crew_roster, assessment_attempts, benefit_plans, interviews, pay_reports to service_role;
