-- Phase 11 (running, part 2): rule-based training plans. Private per user; plans are archived rather than deleted.
-- Sessions have no delete policy; a removed plan is soft-deleted and its sessions are no longer shown.

create table public.run_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  goal text not null check (goal in ('5k','10k','half','marathon')),
  race_date date not null,
  start_date date not null,
  days_per_week int not null check (days_per_week between 3 and 6),
  start_weekly_km int not null check (start_weekly_km between 0 and 250),
  weeks int not null check (weeks between 4 and 24),
  status text not null default 'active' check (status in ('active','archived')),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint run_plans_id_user_unique unique (id, user_id),
  constraint run_plans_dates check (race_date > start_date)
);
create index run_plans_user_idx on public.run_plans (user_id, created_at desc) where deleted_at is null;

create table public.run_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  week int not null check (week between 1 and 24),
  planned_on date not null,
  kind text not null check (kind in ('easy','long','tempo','intervals','race')),
  distance_m int not null check (distance_m between 1000 and 100000),
  description text not null check (char_length(description) between 1 and 500),
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint run_plan_sessions_plan_fk foreign key (plan_id, user_id) references public.run_plans (id, user_id) on delete cascade
);
create index run_plan_sessions_plan_idx on public.run_plan_sessions (plan_id, planned_on);

create trigger run_plans_rev before update on public.run_plans for each row execute function public.bump_revision();
create trigger run_plan_sessions_rev before update on public.run_plan_sessions for each row execute function public.bump_revision();

alter table public.run_plans enable row level security;
alter table public.run_plan_sessions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['run_plans','run_plan_sessions'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;
