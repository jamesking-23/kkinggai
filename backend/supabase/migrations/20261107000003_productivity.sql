-- Phase 5: core productivity (projects, goals, milestones, tasks, events, reminders, habits).
-- Every table is workspace-scoped with RLS. Cross-references use composite foreign keys
-- (id, workspace_id) so a row can never point at another workspace's record.

create or replace function public.bump_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = now();
  return new;
end $$;

create or replace function public.can_write_workspace(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_workspace_role(ws, array['owner','admin','member']::public.workspace_role[]);
$$;
revoke execute on function public.can_write_workspace(uuid) from public, anon;
grant execute on function public.can_write_workspace(uuid) to authenticated;

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  due_date date,
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index projects_workspace_idx on public.projects (workspace_id, status);

-- ---------- goals ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  target_value numeric check (target_value is null or target_value > 0),
  current_value numeric not null default 0 check (current_value >= 0),
  unit text,
  deadline date,
  status text not null default 'active' check (status in ('active','achieved','abandoned')),
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete set null (project_id)
);
create index goals_workspace_idx on public.goals (workspace_id, status);

-- ---------- milestones (belong to a goal or a project) ----------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  goal_id uuid,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  check (goal_id is not null or project_id is not null),
  foreign key (goal_id, workspace_id) references public.goals (id, workspace_id) on delete cascade,
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete cascade
);
create index milestones_workspace_idx on public.milestones (workspace_id, due_date);

-- ---------- tasks ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid,
  parent_task_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  priority smallint not null default 2 check (priority between 1 and 4), -- 1 = urgent, 4 = low
  category text,
  due_at timestamptz,
  completed_at timestamptz,
  recurrence_rule text, -- RFC 5545 RRULE, interpreted by the application
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz, -- deletion marker for sync
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (parent_task_id is distinct from id),
  foreign key (project_id, workspace_id) references public.projects (id, workspace_id) on delete set null (project_id),
  foreign key (parent_task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade
);
create index tasks_workspace_status_idx on public.tasks (workspace_id, status) where deleted_at is null;
create index tasks_due_idx on public.tasks (workspace_id, due_at) where deleted_at is null and status in ('todo','in_progress');
create index tasks_project_idx on public.tasks (project_id);
create index tasks_parent_idx on public.tasks (parent_task_id);

-- Completion history (one row per completion, so recurring tasks keep a record).
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null,
  completed_at timestamptz not null default now(),
  completed_by uuid not null default auth.uid() references auth.users (id),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade
);
create index task_completions_task_idx on public.task_completions (task_id, completed_at desc);

-- ---------- events ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  recurrence_rule text,
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  check (ends_at >= starts_at)
);
create index events_range_idx on public.events (workspace_id, starts_at) where deleted_at is null;

-- ---------- reminders (personal to the user who set them) ----------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null default 'custom' check (target_type in ('task','event','goal','custom')),
  target_id uuid,
  message text not null check (char_length(message) between 1 and 500),
  remind_at timestamptz not null,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  check (target_type = 'custom' or target_id is not null)
);
create index reminders_due_idx on public.reminders (user_id, remind_at) where dismissed_at is null;
create index reminders_workspace_idx on public.reminders (workspace_id);

-- ---------- habits (personal) ----------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  cadence text not null default 'daily' check (cadence in ('daily','weekly')),
  target_per_period smallint not null default 1 check (target_per_period between 1 and 14),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index habits_user_idx on public.habits (user_id) where archived_at is null;

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date),
  foreign key (habit_id, workspace_id) references public.habits (id, workspace_id) on delete cascade
);
create index habit_logs_user_idx on public.habit_logs (user_id, log_date desc);

-- ---------- revision triggers ----------
create trigger projects_rev before update on public.projects for each row execute function public.bump_revision();
create trigger goals_rev before update on public.goals for each row execute function public.bump_revision();
create trigger tasks_rev before update on public.tasks for each row execute function public.bump_revision();
create trigger events_rev before update on public.events for each row execute function public.bump_revision();

-- ---------- RLS ----------
alter table public.projects enable row level security;
alter table public.goals enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.events enable row level security;
alter table public.reminders enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

-- Shared workspace tables: members read; owner/admin/member write (viewers are read-only).
do $$
declare t text;
begin
  foreach t in array array['projects','goals','milestones','tasks','events'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_workspace(workspace_id) and created_by is not distinct from (select auth.uid()))', t || '_insert', t);
  end loop;
  foreach t in array array['projects','goals','tasks','events'] loop
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_workspace(workspace_id))', t || '_delete', t);
  end loop;
end $$;

create policy milestones_update on public.milestones for update to authenticated
  using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));
create policy milestones_delete on public.milestones for delete to authenticated
  using (public.can_write_workspace(workspace_id));
create policy task_completions_select on public.task_completions for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy task_completions_insert on public.task_completions for insert to authenticated
  with check (public.can_write_workspace(workspace_id) and completed_by is not distinct from (select auth.uid()));
create policy task_completions_delete on public.task_completions for delete to authenticated
  using (public.can_write_workspace(workspace_id));

-- Personal tables: only the owner of the row, and only while still a writer in the workspace.
do $$
declare t text;
begin
  foreach t in array array['reminders','habits','habit_logs'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and public.can_write_workspace(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid()) and public.can_write_workspace(workspace_id)) with check (user_id = (select auth.uid()) and public.can_write_workspace(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()) and public.can_write_workspace(workspace_id))', t || '_delete', t);
  end loop;
end $$;

-- ---------- module registry ----------
update public.module_registry set status = 'active', description = 'Tasks and subtasks' where id = 'tasks';
insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('projects', 'Projects', 'Projects and milestones', '0.1.0', 'active', 'Projects', '/projects', 'folder-kanban', 20),
  ('goals', 'Goals', 'Measurable goals and progress', '0.1.0', 'active', 'Goals', '/goals', 'target', 30),
  ('calendar', 'Calendar', 'Events and schedule', '0.1.0', 'active', 'Calendar', '/calendar', 'calendar', 40),
  ('habits', 'Habits', 'Daily and weekly habits', '0.1.0', 'active', 'Habits', '/habits', 'repeat', 50);

-- Enable the newly active modules for any workspace that already exists.
insert into public.workspace_modules (workspace_id, module_id)
select w.id, m.id from public.workspaces w cross join public.module_registry m
where m.status in ('active', 'experimental')
on conflict do nothing;
