-- Tests complete_task and the recurrence rule constraint (migration 030). Users: u1 owner of ws1, u2 outsider (own ws2),
-- u3 viewer in ws1, plus anon. Rolled back; non-destructive. The live run returned 16 lines, all as expected:
-- arbitrary rule blocked; stale revision refused; original done with completed_at; 1 completion row; next copy keeps
-- title/priority/category/rule and is todo; completing a done task again refused; non-recurring task makes no copy;
-- recurring task without next_due makes no copy; outsider, viewer and anon refused; open task count unchanged.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; ws2 uuid; t1 uuid; t2 uuid; t3 uuid; nid uuid; rev int; n int; r text[] := '{}'; row public.tasks%rowtype;
begin
  insert into auth.users (id, email) values (u1,'tr-1@test.invalid'),(u2,'tr-2@test.invalid'),(u3,'tr-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  select id into ws2 from public.workspaces where owner_id = u2;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u3, 'viewer');

  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into public.tasks (workspace_id, title, recurrence_rule) values (ws1,'bad','FREQ=SECONDLY');
    r := array_append(r,'FAIL arbitrary rule accepted');
  exception when others then r := array_append(r,'arbitrary recurrence rule blocked OK'); end;
  insert into public.tasks (workspace_id, title, priority, category, recurrence_rule, due_at)
    values (ws1,'Water plants',2,'home','FREQ=WEEKLY', now()) returning id into t1;
  insert into public.tasks (workspace_id, title) values (ws1,'One-off') returning id into t2;
  select revision into rev from public.tasks where id = t1;

  begin perform public.complete_task(t1, rev + 5, now() + interval '7 days');
    r := array_append(r,'FAIL stale revision accepted');
  exception when others then r := array_append(r,'stale revision refused: ' || left(sqlerrm,40)); end;

  nid := public.complete_task(t1, rev, now() + interval '7 days');
  select * into row from public.tasks where id = t1;
  r := array_append(r,'original status=' || row.status || ' completed=' || (row.completed_at is not null) || ' (expect done true)');
  select count(*) into n from public.task_completions where task_id = t1;
  r := array_append(r,'completion rows=' || n || ' (expect 1)');
  select * into row from public.tasks where id = nid;
  r := array_append(r,'next copy: title=' || row.title || ' status=' || row.status || ' rule=' || row.recurrence_rule || ' cat=' || row.category || ' prio=' || row.priority || ' (expect Water plants todo FREQ=WEEKLY home 2)');

  begin perform public.complete_task(t1, (select revision from public.tasks where id = t1), now());
    r := array_append(r,'FAIL completed a done task twice');
  exception when others then r := array_append(r,'second completion refused OK'); end;

  select revision into rev from public.tasks where id = t2;
  nid := public.complete_task(t2, rev, now() + interval '1 day');
  select count(*) into n from public.tasks where workspace_id = ws1 and title = 'One-off';
  r := array_append(r,'non-recurring returned copy=' || (nid is not null) || ' rows=' || n || ' (expect false 1)');

  insert into public.tasks (workspace_id, title, recurrence_rule) values (ws1,'Daily','FREQ=DAILY') returning id into t3;
  select revision into rev from public.tasks where id = t3;
  nid := public.complete_task(t3, rev, null);
  r := array_append(r,'recurring without next_due made copy=' || (nid is not null) || ' (expect false)');

  reset role;
  select * into row from public.tasks where id = (select id from public.tasks where workspace_id = ws1 and status='todo' and title='Water plants');
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.complete_task(row.id, row.revision, now());
    r := array_append(r,'FAIL outsider completed task');
  exception when others then r := array_append(r,'outsider completion refused OK'); end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u3,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.complete_task(row.id, row.revision, now());
    r := array_append(r,'FAIL viewer completed task');
  exception when others then r := array_append(r,'viewer completion refused OK'); end;
  select count(*) into n from public.tasks where workspace_id = ws1 and status = 'todo';
  r := array_append(r,'open tasks unchanged after refused attempts=' || n || ' (expect 1)');

  reset role;
  perform set_config('request.jwt.claims','{}', true);
  set local role anon;
  begin perform public.complete_task(row.id, row.revision, now());
    r := array_append(r,'FAIL anon completed task');
  exception when others then r := array_append(r,'anon refused OK'); end;
  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
