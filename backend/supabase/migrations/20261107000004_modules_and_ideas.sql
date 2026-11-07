-- Phase 6: module activation rules and the Idea Inbox.

-- ---------- core modules ----------
alter table public.module_registry add column core boolean not null default false;
update public.module_registry set core = true where id = 'dashboard';

-- ---------- workspace_modules: clients may only toggle existing rows ----------
-- Rows are created by signup provisioning / migrations, never by clients, so a module cannot be
-- "re-inserted" to dodge the dependency rules below.
drop policy workspace_modules_write on public.workspace_modules;
create policy workspace_modules_update on public.workspace_modules for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.workspace_role[]));

-- Runs as the invoking user (not security definer); it only reads rows the caller can already see.
create or replace function public.enforce_module_rules() returns trigger
language plpgsql set search_path = '' as $$
declare missing text; blocker text; is_core boolean;
begin
  if new.enabled is not distinct from old.enabled then
    return new;
  end if;

  if new.enabled then
    select d into missing
    from unnest((select r.dependencies from public.module_registry r where r.id = new.module_id)) as d
    where not exists (
      select 1 from public.workspace_modules wm
      where wm.workspace_id = new.workspace_id and wm.module_id = d and wm.enabled
    )
    limit 1;
    if missing is not null then
      raise exception 'Module % requires % to be enabled first', new.module_id, missing
        using errcode = '23514';
    end if;
  else
    select r.core into is_core from public.module_registry r where r.id = new.module_id;
    if is_core then
      raise exception 'Module % is a core module and cannot be disabled', new.module_id
        using errcode = '23514';
    end if;
    select wm.module_id into blocker
    from public.workspace_modules wm
    join public.module_registry r on r.id = wm.module_id
    where wm.workspace_id = new.workspace_id and wm.enabled and new.module_id = any (r.dependencies)
    limit 1;
    if blocker is not null then
      raise exception 'Module % is required by %', new.module_id, blocker using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger workspace_modules_rules before update on public.workspace_modules
  for each row execute function public.enforce_module_rules();

-- ---------- Idea Inbox ----------
create table public.idea_backlog (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  category text,
  priority smallint not null default 3 check (priority between 1 and 4), -- 1 = highest
  status text not null default 'captured'
    check (status in ('captured','planned','in_development','active','experimental','deprecated')),
  related_module text references public.module_registry (id) on delete set null,
  notes text not null default '',
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(), -- "date captured"
  updated_at timestamptz not null default now()
);
create index idea_backlog_workspace_idx on public.idea_backlog (workspace_id, status) where deleted_at is null;

create trigger idea_backlog_rev before update on public.idea_backlog
  for each row execute function public.bump_revision();

alter table public.idea_backlog enable row level security;
create policy idea_backlog_select on public.idea_backlog for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy idea_backlog_insert on public.idea_backlog for insert to authenticated
  with check (public.can_write_workspace(workspace_id) and created_by is not distinct from (select auth.uid()));
create policy idea_backlog_update on public.idea_backlog for update to authenticated
  using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));
create policy idea_backlog_delete on public.idea_backlog for delete to authenticated
  using (public.can_write_workspace(workspace_id));

-- ---------- register the module and enable it everywhere ----------
insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('ideas', 'Idea Inbox', 'Capture and track future ideas', '0.1.0', 'active', 'Idea Inbox', '/ideas', 'lightbulb', 90);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'ideas' from public.workspaces w
on conflict do nothing;
