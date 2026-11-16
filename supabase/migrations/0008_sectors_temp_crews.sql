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
