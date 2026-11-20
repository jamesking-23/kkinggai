-- Heart-rate zones for running. Imported runs keep a histogram of seconds spent at each 5 bpm step, so zones can be
-- worked out for any maximum heart rate without re-importing. The user's maximum heart rate lives in run_profiles.

alter table public.run_activities
  add column hr_buckets jsonb
  check (hr_buckets is null or (jsonb_typeof(hr_buckets) = 'object' and octet_length(hr_buckets::text) <= 2000));

create table public.run_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  max_hr int check (max_hr is null or max_hr between 100 and 230),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger run_profiles_rev before update on public.run_profiles for each row execute function public.bump_revision();

alter table public.run_profiles enable row level security;
create policy run_profiles_select on public.run_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy run_profiles_insert on public.run_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy run_profiles_update on public.run_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- no delete policy
