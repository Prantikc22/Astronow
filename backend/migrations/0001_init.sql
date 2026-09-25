-- AstroNow — initial schema (Supabase / Postgres).
-- All app tables key on the Supabase auth user id. The FastAPI service connects
-- with elevated privileges and ALWAYS filters by user_id; RLS policies below are
-- defense-in-depth for any direct client access.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  user_id uuid primary key,
  first_name text,
  dob date,
  birth_time time,
  birth_time_known boolean default true,
  birthplace text,
  lat double precision,
  lon double precision,
  tz_offset double precision,
  tz_name text,
  gender text,
  relationship_status text,
  interests jsonb default '[]'::jsonb,
  terminology_mode text default 'both',
  language text default 'en',
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists birth_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chart jsonb not null,
  dasha jsonb,
  numerology jsonb,
  computed_at timestamptz default now(),
  unique (user_id)
);

create table if not exists saved_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  relation text,
  dob date,
  birth_time time,
  birth_time_known boolean default true,
  birthplace text,
  lat double precision,
  lon double precision,
  tz_offset double precision,
  chart jsonb,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text default 'New conversation',
  summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  content text not null,
  topic text,
  created_at timestamptz default now()
);
create index if not exists idx_messages_convo on messages(conversation_id, created_at);

create table if not exists tarot_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  spread text,
  cards jsonb,
  note text,
  interpretation text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists vastu_homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text default 'My Home',
  rooms jsonb default '[]'::jsonb,
  north_rotation double precision default 0,
  analysis jsonb,
  source text default 'draw',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists compatibility_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  partner_name text,
  relation text,
  result jsonb,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  feature text,
  model text,
  input_tokens int default 0,
  output_tokens int default 0,
  cost_input double precision default 0,
  cost_output double precision default 0,
  created_at timestamptz default now()
);
create index if not exists idx_usage_user_day on usage_events(user_id, created_at);

create table if not exists entitlements (
  user_id uuid primary key,
  tier text default 'free',
  source text,
  rc_customer_id text,
  expires_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists notification_prefs (
  user_id uuid primary key,
  prefs jsonb default '{"daily_guidance":true,"major_events":true,"calendar":true,"saved_timings":true,"product_updates":false}'::jsonb
);

create table if not exists saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text,
  payload jsonb,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text,
  props jsonb,
  created_at timestamptz default now()
);

create table if not exists app_config (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Clients may read their own records. All writes go through the authenticated
-- API, which applies the birth-detail, usage and purchase rules. The service
-- role / database owner bypasses RLS for those server-side writes.
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
    execute format(
      'create policy own_read on %I for select to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

alter table app_config enable row level security;
create policy config_read on app_config for select to authenticated using (true);
