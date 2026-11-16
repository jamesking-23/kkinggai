-- Phase 12 (business, part 1): private ventures and their income/expense ledger. No workspace sharing; soft delete only.

create table public.ventures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  stage text not null default 'idea' check (stage in ('idea','validating','building','launched','paused','closed')),
  currency text not null default 'UGX' check (currency ~ '^[A-Z]{3}$'),
  website text check (website is null or website ~* '^https?://'),
  started_on date,
  notes text not null default '' check (char_length(notes) <= 4000),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index ventures_user_idx on public.ventures (user_id, stage, created_at desc) where deleted_at is null;

create table public.venture_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venture_id uuid not null,
  kind text not null check (kind in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0 and amount < 1e12),
  occurred_on date not null default current_date,
  category text check (category is null or char_length(category) <= 60),
  description text not null default '' check (char_length(description) <= 500),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (venture_id, user_id) references public.ventures (id, user_id) on delete cascade
);
create index venture_entries_idx on public.venture_entries (user_id, venture_id, occurred_on desc) where deleted_at is null;

create trigger ventures_rev before update on public.ventures for each row execute function public.bump_revision();
create trigger venture_entries_rev before update on public.venture_entries for each row execute function public.bump_revision();

alter table public.ventures enable row level security;
alter table public.venture_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ventures','venture_entries'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('business', 'Business', 'Ventures with an income and expense ledger', '0.1.0', 'active', 'Business', '/business', 'briefcase', 80);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'business' from public.workspaces w
on conflict do nothing;
