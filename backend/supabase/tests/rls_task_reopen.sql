-- Live result (2026-11-21): 15 lines, all as expected.
-- Tests reopen_task and the subtask/reminder carry-over of complete_task (migration 036). Rollback-only.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; t1 uuid; nid uuid; rev int; n int; b boolean; r text[] := '{}'; due0 timestamptz := now() + interval '1 day';
  nid2 uuid; t2 uuid; sub1 uuid;
begin
  insert into auth.users (id, email) values (u1,'to-1@test.invalid'),(u2,'to-2@test.invalid'),(u3,'to-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u3, 'viewer');
  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;

  insert into public.tasks (workspace_id, title, recurrence_rule, due_at) values (ws1,'Weekly','FREQ=WEEKLY',due0) returning id into t1;
  insert into public.tasks (workspace_id, parent_task_id, title) values (ws1,t1,'Sub A') returning id into sub1;
  insert into public.reminders (workspace_id, target_type, target_id, message, remind_at) values (ws1,'task',t1,'ping',due0 - interval '1 hour');
  select revision into rev from public.tasks where id = t1;
  nid := public.complete_task(t1, rev, due0 + interval '7 days');
  select count(*) into n from public.tasks where parent_task_id = nid and title = 'Sub A' and status = 'todo';
  r := array_append(r,'subtask copied=' || n || ' (expect 1)');
  select count(*) into n from public.reminders where target_id = nid and remind_at = due0 + interval '7 days' - interval '1 hour';
  r := array_append(r,'reminder copied with shifted time=' || n || ' (expect 1)');
  select count(*) into n from public.tasks where id = t1 and spawned_task_id = nid;
  r := array_append(r,'spawned link set=' || n || ' (expect 1)');

  select revision into rev from public.tasks where id = t1;
  b := public.reopen_task(t1, rev);
  r := array_append(r,'reopen removed copy=' || b || ' (expect true)');
  select count(*) into n from public.tasks where id = nid and deleted_at is not null;
  r := array_append(r,'copy soft-deleted=' || n || ' (expect 1)');
  select count(*) into n from public.tasks where parent_task_id = nid and deleted_at is null;
  r := array_append(r,'copy subtasks live=' || n || ' (expect 0)');
  select count(*) into n from public.reminders where target_id = nid and dismissed_at is null;
  r := array_append(r,'copy reminders live=' || n || ' (expect 0)');
  select count(*) into n from public.tasks where id = t1 and status = 'todo' and completed_at is null and spawned_task_id is null;
  r := array_append(r,'original reopened, link cleared=' || n || ' (expect 1)');
  begin perform public.reopen_task(t1, rev); r := array_append(r,'FAIL stale revision accepted');
  exception when others then r := array_append(r,'stale revision refused OK'); end;

  -- a copy that was started is kept
  select revision into rev from public.tasks where id = t1;
  nid2 := public.complete_task(t1, rev, due0 + interval '14 days');
  update public.tasks set status = 'in_progress' where id = nid2;
  select revision into rev from public.tasks where id = t1;
  b := public.reopen_task(t1, rev);
  r := array_append(r,'started copy kept, removed=' || b || ' (expect false)');
  select count(*) into n from public.tasks where id = nid2 and deleted_at is null;
  r := array_append(r,'started copy live=' || n || ' (expect 1)');

  -- non-recurring: no link, reopen removes nothing
  insert into public.tasks (workspace_id, title) values (ws1,'One-off') returning id into t2;
  select revision into rev from public.tasks where id = t2;
  perform public.complete_task(t2, rev, null);
  select revision into rev from public.tasks where id = t2;
  b := public.reopen_task(t2, rev);
  r := array_append(r,'one-off reopen removed=' || b || ' (expect false)');

  -- viewer and outsider cannot reopen
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u3,'role','authenticated')::text, true);
  set local role authenticated;
  select revision into rev from public.tasks where id = t2;
  begin perform public.reopen_task(t2, rev); r := array_append(r,'FAIL viewer reopened');
  exception when others then r := array_append(r,'viewer reopen refused OK'); end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.reopen_task(t2, rev); r := array_append(r,'FAIL outsider reopened');
  exception when others then r := array_append(r,'outsider reopen refused OK'); end;
  reset role;
  set local role anon;
  begin perform public.reopen_task(t2, rev); r := array_append(r,'FAIL anon reopened');
  exception when others then r := array_append(r,'anon reopen refused OK'); end;
  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
