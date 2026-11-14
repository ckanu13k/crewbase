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
