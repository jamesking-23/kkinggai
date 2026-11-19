-- Recurring tasks: recurrence_rule holds one of five fixed iCalendar-style rules (the app offers daily, weekdays, weekly,
-- monthly, yearly). Completing a recurring task marks it done, records the completion and creates the next copy in one
-- transaction. SECURITY INVOKER: every statement runs under the caller's row-level security, so nothing is bypassed.
alter table public.tasks add constraint tasks_recurrence_rule_check check (
  recurrence_rule is null or recurrence_rule in (
    'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'FREQ=WEEKLY', 'FREQ=MONTHLY', 'FREQ=YEARLY'));

create function public.complete_task(task_id uuid, expected_revision int, next_due timestamptz default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare t public.tasks%rowtype; nid uuid;
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
  end if;
  return nid;
end $$;

revoke all on function public.complete_task(uuid, int, timestamptz) from public, anon;
grant execute on function public.complete_task(uuid, int, timestamptz) to authenticated;
