-- Recurring tasks, follow-up: remember which copy a completion spawned so reopening can remove it, and carry open
-- subtasks and task reminders over to the next copy. SECURITY INVOKER throughout: row-level security still applies.
alter table public.tasks add column spawned_task_id uuid references public.tasks (id) on delete set null;
create index tasks_spawned_idx on public.tasks (spawned_task_id) where spawned_task_id is not null;

create or replace function public.complete_task(task_id uuid, expected_revision int, next_due timestamptz default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare t public.tasks%rowtype; nid uuid; shift interval;
begin
  update public.tasks set status = 'done', completed_at = now()
  where id = task_id and revision = expected_revision and deleted_at is null and status in ('todo','in_progress')
  returning * into t;
  if not found then raise exception 'This task was changed elsewhere. Reload and try again.'; end if;
  insert into public.task_completions (workspace_id, task_id) values (t.workspace_id, t.id);
  if t.recurrence_rule is not null and next_due is not null then
    insert into public.tasks (workspace_id, project_id, title, description, priority, category, due_at, recurrence_rule)
    values (t.workspace_id, t.project_id, t.title, t.description, t.priority, t.category, next_due, t.recurrence_rule)
    returning id into nid;
    update public.tasks set spawned_task_id = nid where id = t.id;
    -- open subtasks come along, reset to todo
    insert into public.tasks (workspace_id, parent_task_id, title, description, priority, category)
    select workspace_id, nid, title, description, priority, category
    from public.tasks where parent_task_id = t.id and deleted_at is null and status <> 'cancelled';
    -- pending reminders for this task move with the same offset as the due date
    if t.due_at is not null then
      shift := next_due - t.due_at;
      insert into public.reminders (workspace_id, user_id, target_type, target_id, message, remind_at)
      select workspace_id, user_id, 'task', nid, message, remind_at + shift
      from public.reminders
      where target_type = 'task' and target_id = t.id and dismissed_at is null and user_id = (select auth.uid());
    end if;
  end if;
  return nid;
end $$;

-- Reopens a done task. If completing it spawned a copy that nobody has touched (still todo), that copy and its
-- subtasks are soft-deleted and its reminders dismissed, so reopening does not leave a duplicate. Returns true when a
-- copy was removed.
create function public.reopen_task(task_id uuid, expected_revision int)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare t public.tasks%rowtype; removed boolean := false; sp uuid;
begin
  update public.tasks set status = 'todo', completed_at = null
  where id = task_id and revision = expected_revision and deleted_at is null
  returning * into t;
  if not found then raise exception 'This task was changed elsewhere. Reload and try again.'; end if;
  sp := t.spawned_task_id;
  if sp is not null then
    update public.tasks set deleted_at = now()
    where id = sp and status = 'todo' and deleted_at is null and completed_at is null;
    if found then
      removed := true;
      update public.tasks set deleted_at = now() where parent_task_id = sp and deleted_at is null;
      update public.reminders set dismissed_at = now()
      where target_type = 'task' and target_id = sp and dismissed_at is null and user_id = (select auth.uid());
    end if;
    update public.tasks set spawned_task_id = null where id = t.id;
  end if;
  return removed;
end $$;

revoke all on function public.reopen_task(uuid, int) from public, anon;
grant execute on function public.reopen_task(uuid, int) to authenticated;
