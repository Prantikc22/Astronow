-- Harden projects that already applied 0001: direct Supabase client writes
-- must not bypass API-enforced birth-profile locks or paid entitlements.
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','birth_charts','saved_profiles','conversations','messages',
    'tarot_readings','vastu_homes','compatibility_reports','usage_events',
    'entitlements','notification_prefs','saved_items','analytics_events'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format('drop policy if exists own_read on %I', t);
    execute format(
      'create policy own_read on %I for select to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

alter table app_config enable row level security;
drop policy if exists config_read on app_config;
create policy config_read on app_config for select to authenticated using (true);
