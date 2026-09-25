-- A report purchase belongs to one primary birth chart. Users get one genuine
-- correction after onboarding; further changes require support review.
alter table profiles
  add column if not exists birth_details_change_count integer not null default 0,
  add column if not exists birth_details_locked_at timestamptz;

update profiles
set birth_details_locked_at = coalesce(birth_details_locked_at, updated_at, created_at, now())
where onboarded = true and birth_details_locked_at is null;

alter table profiles
  add constraint profiles_birth_details_change_count_check
  check (birth_details_change_count between 0 and 1) not valid;

alter table profiles validate constraint profiles_birth_details_change_count_check;
