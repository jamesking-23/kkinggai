-- Phase 10 (part 2): career. All career data is private to its owner (no workspace sharing).
-- Soft delete where rows are user-managed lists; no delete policies.

create table public.career_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  headline text not null default '' check (char_length(headline) <= 200),
  summary text not null default '' check (char_length(summary) <= 4000),
  location text check (location is null or char_length(location) <= 120),
  website text check (website is null or website ~* '^https?://'),
  linkedin_url text check (linkedin_url is null or linkedin_url ~* '^https?://'),
  github_url text check (github_url is null or github_url ~* '^https?://'),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cv_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('experience','education','skill','project','certification','award','other')),
  title text not null check (char_length(title) between 1 and 200),
  organisation text check (organisation is null or char_length(organisation) <= 200),
  location text check (location is null or char_length(location) <= 120),
  start_date date,
  end_date date,
  description text not null default '' check (char_length(description) <= 4000),
  sort_order int not null default 0,
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index cv_entries_user_idx on public.cv_entries (user_id, kind, start_date desc) where deleted_at is null;

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null check (char_length(company) between 1 and 200),
  role text not null check (char_length(role) between 1 and 200),
  url text check (url is null or url ~* '^https?://'),
  status text not null default 'wishlist'
    check (status in ('wishlist','applied','interviewing','offer','rejected','withdrawn')),
  location text check (location is null or char_length(location) <= 120),
  applied_on date,
  deadline date,
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  notes text not null default '' check (char_length(notes) <= 4000),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index job_applications_user_idx on public.job_applications (user_id, status, created_at desc) where deleted_at is null;

create table public.interview_prep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id uuid,
  category text not null default 'behavioural'
    check (category in ('behavioural','technical','situational','company','other')),
  question text not null check (char_length(question) between 1 and 1000),
  answer text not null default '' check (char_length(answer) <= 4000),
  confidence smallint not null default 3 check (confidence between 1 and 5),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.job_applications (id, user_id) on delete set null (application_id)
);
create index interview_prep_user_idx on public.interview_prep (user_id, category) where deleted_at is null;

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'project' check (kind in ('project','publication','certificate','design','other')),
  title text not null check (char_length(title) between 1 and 200),
  url text check (url is null or url ~* '^https?://'),
  description text not null default '' check (char_length(description) <= 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolio_items_user_idx on public.portfolio_items (user_id, created_at desc) where deleted_at is null;

create trigger career_profiles_rev before update on public.career_profiles for each row execute function public.bump_revision();
create trigger cv_entries_rev before update on public.cv_entries for each row execute function public.bump_revision();
create trigger job_applications_rev before update on public.job_applications for each row execute function public.bump_revision();
create trigger interview_prep_rev before update on public.interview_prep for each row execute function public.bump_revision();
create trigger portfolio_items_rev before update on public.portfolio_items for each row execute function public.bump_revision();

alter table public.career_profiles enable row level security;
alter table public.cv_entries enable row level security;
alter table public.job_applications enable row level security;
alter table public.interview_prep enable row level security;
alter table public.portfolio_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['career_profiles','cv_entries','job_applications','interview_prep','portfolio_items'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('career', 'Career', 'Applications, CV, interview prep and portfolio', '0.1.0', 'active', 'Career', '/career', 'briefcase', 64);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'career' from public.workspaces w
on conflict do nothing;
