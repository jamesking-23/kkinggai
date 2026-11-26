-- Attempted: copy attachments to the next copy of a recurring task inside complete_task. Abandoned: the
-- task_attachment_path check requires storage_path to contain the row's own task id, so a copy cannot reuse the
-- original file path without loosening that constraint (or copying the file in storage, which SQL cannot do).
-- Production was briefly changed and then restored; this migration leaves complete_task exactly as in migration 036.
create or replace function public.complete_task(task_id uuid, expected_revision integer, next_due timestamptz default null)
returns uuid
language plpgsql
set search_path = ''
as $function$
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
    insert into public.tasks (workspace_id, parent_task_id, title, description, priority, category)
    select workspace_id, nid, title, description, priority, category
    from public.tasks where parent_task_id = t.id and deleted_at is null and status <> 'cancelled';
    if t.due_at is not null then
      shift := next_due - t.due_at;
      insert into public.reminders (workspace_id, user_id, target_type, target_id, message, remind_at)
      select workspace_id, user_id, 'task', nid, message, remind_at + shift
      from public.reminders
      where target_type = 'task' and target_id = t.id and dismissed_at is null and user_id = (select auth.uid());
    end if;
  end if;
  return nid;
end $function$;
