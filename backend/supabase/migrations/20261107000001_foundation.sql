-- Phase 2 foundation: identity, workspaces, module registry, settings, audit.
-- Every table has RLS enabled. Writes that must not be client-controlled have no policy.

create type public.workspace_kind as enum ('personal', 'business', 'shared');
create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.module_status as enum ('planned', 'experimental', 'active', 'deprecated');

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind public.workspace_kind not null default 'personal',
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_owner_idx on public.workspaces (owner_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.module_registry (
  id text primary key check (id ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  description text not null default '',
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  status public.module_status not null default 'planned',
  dependencies text[] not null default '{}',
  permissions text[] not null default '{}',
  nav_label text,
  nav_href text,
  nav_icon text,
  nav_order int not null default 100
);

create table public.workspace_modules (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module_id text not null references public.module_registry (id),
  enabled boolean not null default true,
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (workspace_id, module_id)
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_workspace_idx on public.audit_logs (workspace_id, created_at desc);

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger workspaces_updated before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger workspace_modules_updated before update on public.workspace_modules
  for each row execute function public.set_updated_at();
create trigger user_settings_updated before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------- helper functions (security definer avoids RLS recursion) ----------
create or replace function public.is_workspace_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid())
  );
$$;

create or replace function public.has_workspace_role(ws uuid, roles public.workspace_role[])
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = (select auth.uid()) and role = any (roles)
  );
$$;

revoke execute on function public.is_workspace_member(uuid) from public, anon;
revoke execute on function public.has_workspace_role(uuid, public.workspace_role[]) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

-- ---------- signup provisioning ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (name, kind, owner_id)
  values ('Personal', 'personal', new.id) returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  insert into public.user_settings (user_id) values (new.id);

  insert into public.workspace_modules (workspace_id, module_id)
  select ws, id from public.module_registry where status in ('active', 'experimental');
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Creating a workspace through the API also makes the creator its owner.
create or replace function public.add_workspace_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner') on conflict do nothing;
  return new;
end $$;

revoke execute on function public.add_workspace_owner() from public, anon, authenticated;
create trigger workspaces_add_owner after insert on public.workspaces
  for each row execute function public.add_workspace_owner();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.module_registry enable row level security;
alter table public.workspace_modules enable row level security;
alter table public.user_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (public.has_workspace_role(id, array['owner']::public.workspace_role[]));

create policy members_select on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
              and role <> 'owner');
create policy members_update on public.workspace_members for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
         and role <> 'owner')
  with check (role <> 'owner');
create policy members_delete on public.workspace_members for delete to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[])
         and role <> 'owner');

create policy module_registry_read on public.module_registry for select to authenticated
  using (true);

create policy workspace_modules_select on public.workspace_modules for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy workspace_modules_write on public.workspace_modules for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

create policy user_settings_own on public.user_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy audit_select on public.audit_logs for select to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (actor_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
-- No update/delete policies: audit logs are append-only for clients.

-- ---------- seed: modules known so far ----------
insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('dashboard', 'Dashboard', 'Overview of your workspace', '0.1.0', 'active', 'Dashboard', '/', 'layout-dashboard', 0),
  ('tasks', 'Tasks', 'Tasks, projects and goals', '0.1.0', 'planned', 'Tasks', '/tasks', 'check-square', 10);
