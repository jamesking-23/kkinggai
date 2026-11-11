-- Phase 11 (running, part 1): private per-user run activities. Manual entry and GPX import; Strava/Samsung come later.
-- Soft delete only; no workspace sharing. The route is a downsampled list of [lat, lon] pairs.

create table public.run_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','gpx','strava','samsung')),
  external_id text check (external_id is null or char_length(external_id) <= 100),
  name text not null check (char_length(name) between 1 and 200),
  kind text not null default 'easy' check (kind in ('easy','long','tempo','intervals','race','trail','treadmill','other')),
  started_at timestamptz not null,
  distance_m int not null check (distance_m between 1 and 1000000),
  moving_seconds int not null check (moving_seconds between 1 and 864000),
  elapsed_seconds int check (elapsed_seconds is null or elapsed_seconds >= 1),
  elevation_gain_m int check (elevation_gain_m is null or elevation_gain_m between 0 and 20000),
  avg_hr int check (avg_hr is null or avg_hr between 30 and 250),
  effort int check (effort is null or effort between 1 and 10),
  notes text not null default '' check (char_length(notes) <= 4000),
  route jsonb check (route is null or (jsonb_typeof(route) = 'array' and jsonb_array_length(route) <= 600)),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint run_moving_le_elapsed check (elapsed_seconds is null or moving_seconds <= elapsed_seconds)
);
create index run_activities_user_idx on public.run_activities (user_id, started_at desc) where deleted_at is null;
create unique index run_activities_external_uniq on public.run_activities (user_id, source, external_id)
  where external_id is not null and deleted_at is null;

create trigger run_activities_rev before update on public.run_activities for each row execute function public.bump_revision();

alter table public.run_activities enable row level security;
create policy run_activities_select on public.run_activities for select to authenticated using (user_id = (select auth.uid()));
create policy run_activities_insert on public.run_activities for insert to authenticated with check (user_id = (select auth.uid()));
create policy run_activities_update on public.run_activities for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- no delete policy: activities are soft-deleted via deleted_at

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('running', 'Running', 'Activities, routes and training analytics', '0.1.0', 'active', 'Running', '/running', 'footprints', 72);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'running' from public.workspaces w
on conflict do nothing;
