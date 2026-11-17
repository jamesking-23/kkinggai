-- Phase 13 (personal life, part 1): a private journal and important dates. Owner only, soft delete, no DELETE policies.

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  mood int check (mood is null or mood between 1 and 5),
  body text not null check (char_length(body) between 1 and 20000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index journal_entries_day_uniq on public.journal_entries (user_id, entry_date) where deleted_at is null;

create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'other' check (kind in ('birthday','anniversary','deadline','other')),
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  year int check (year is null or year between 1900 and 2200),
  notes text not null default '' check (char_length(notes) <= 1000),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (make_date(coalesce(year, 2000), month, 1) + (day - 1) < make_date(coalesce(year, 2000), month, 1) + interval '1 month')
);
create index important_dates_user_idx on public.important_dates (user_id, month, day) where deleted_at is null;

create trigger journal_entries_rev before update on public.journal_entries for each row execute function public.bump_revision();
create trigger important_dates_rev before update on public.important_dates for each row execute function public.bump_revision();

alter table public.journal_entries enable row level security;
alter table public.important_dates enable row level security;

do $$
declare t text;
begin
  foreach t in array array['journal_entries','important_dates'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('personal', 'Personal', 'Private journal and important dates', '0.1.0', 'active', 'Personal', '/personal', 'heart', 90);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'personal' from public.workspaces w
on conflict do nothing;
