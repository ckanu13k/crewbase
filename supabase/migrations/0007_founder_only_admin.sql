-- Admin is founder-only (ADMIN_EMAILS / STAFF_EMAILS). Team rows are recruiters.
update team_members set role = 'recruiter' where role <> 'recruiter';
alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check check (role = 'recruiter');
