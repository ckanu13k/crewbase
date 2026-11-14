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
