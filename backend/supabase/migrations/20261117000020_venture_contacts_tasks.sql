-- Phase 12 (business, part 2): private contacts and tasks per venture. Same rules as ventures: owner only, soft delete, no DELETE policies.

create table public.venture_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venture_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  role text not null default 'other' check (role in ('customer','supplier','partner','investor','mentor','other')),
  email text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or char_length(phone) <= 40),
  notes text not null default '' check (char_length(notes) <= 2000),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (venture_id, user_id) references public.ventures (id, user_id) on delete cascade
);
create index venture_contacts_idx on public.venture_contacts (user_id, venture_id, created_at desc) where deleted_at is null;

create table public.venture_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venture_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_on date,
  notes text not null default '' check (char_length(notes) <= 2000),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (venture_id, user_id) references public.ventures (id, user_id) on delete cascade
);
create index venture_tasks_idx on public.venture_tasks (user_id, venture_id, status, due_on) where deleted_at is null;

create trigger venture_contacts_rev before update on public.venture_contacts for each row execute function public.bump_revision();
create trigger venture_tasks_rev before update on public.venture_tasks for each row execute function public.bump_revision();

alter table public.venture_contacts enable row level security;
alter table public.venture_tasks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['venture_contacts','venture_tasks'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;
