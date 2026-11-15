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
