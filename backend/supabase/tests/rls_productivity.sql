-- RLS test for productivity tables. Three users: u1 owner of ws1, u2 viewer in ws1 (owner of own ws2), u3 outsider.
-- Rolls back via a final exception that carries the results.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; ws2 uuid; p1 uuid; p2 uuid; t1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'p-a@test.invalid'), (u2, 'p-b@test.invalid'), (u3, 'p-c@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  select id into ws2 from public.workspaces where owner_id = u2;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'viewer');
  insert into public.projects (workspace_id, name, created_by) values (ws2, 'u2 project', u2) returning id into p2;

  -- ===== u1: owner of ws1 =====
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.projects (workspace_id, name) values (ws1, 'P1') returning id into p1;
  insert into public.tasks (workspace_id, project_id, title) values (ws1, p1, 'T1') returning id into t1;
  r := array_append(r, 'u1 created project and task in own workspace OK');

  update public.tasks set title = 'T1b' where id = t1;
  select revision into rev from public.tasks where id = t1;
  r := array_append(r, 'revision after one update=' || rev || ' (expect 2)');

  begin insert into public.tasks (workspace_id, title) values (ws2, 'intruder');
    r := array_append(r, 'FAIL u1 wrote task into ws2');
  exception when others then r := array_append(r, 'u1 task insert into foreign ws blocked OK'); end;

  begin insert into public.tasks (workspace_id, project_id, title) values (ws1, p2, 'cross link');
    r := array_append(r, 'FAIL task linked to foreign project');
  exception when others then r := array_append(r, 'task -> foreign-workspace project blocked OK'); end;

  begin insert into public.tasks (workspace_id, title, created_by) values (ws1, 'spoof', u2);
    r := array_append(r, 'FAIL created_by spoof accepted');
  exception when others then r := array_append(r, 'created_by spoof blocked OK'); end;

  begin update public.tasks set parent_task_id = id where id = t1;
    r := array_append(r, 'FAIL task is its own parent');
  exception when others then r := array_append(r, 'self-parent task blocked OK'); end;

  begin insert into public.tasks (workspace_id, title, priority) values (ws1, 'bad', 9);
    r := array_append(r, 'FAIL priority 9 accepted');
  exception when others then r := array_append(r, 'invalid priority blocked OK'); end;

  insert into public.reminders (workspace_id, message, remind_at) values (ws1, 'private', now());
  insert into public.habits (workspace_id, name) values (ws1, 'run');
  r := array_append(r, 'u1 created reminder and habit OK');

  -- ===== u2: viewer in ws1 =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.tasks where workspace_id = ws1;
  r := array_append(r, 'viewer reads ws1 tasks=' || n || ' (expect 1)');
  begin insert into public.tasks (workspace_id, title) values (ws1, 'viewer write');
    r := array_append(r, 'FAIL viewer inserted task');
  exception when others then r := array_append(r, 'viewer insert blocked OK'); end;
  update public.tasks set title = 'hacked' where id = t1; get diagnostics n = row_count;
  r := array_append(r, 'viewer update rows=' || n || ' (expect 0)');
  delete from public.tasks where id = t1; get diagnostics n = row_count;
  r := array_append(r, 'viewer delete rows=' || n || ' (expect 0)');
  select count(*) into n from public.reminders;
  r := array_append(r, 'viewer sees others reminders=' || n || ' (expect 0)');
  select count(*) into n from public.habits;
  r := array_append(r, 'viewer sees others habits=' || n || ' (expect 0)');
  begin insert into public.reminders (workspace_id, message, remind_at) values (ws1, 'x', now());
    r := array_append(r, 'FAIL viewer created reminder in ws1');
  exception when others then r := array_append(r, 'viewer reminder insert in ws1 blocked OK'); end;
  begin insert into public.reminders (workspace_id, user_id, message, remind_at) values (ws2, u1, 'x', now());
    r := array_append(r, 'FAIL reminder created for another user');
  exception when others then r := array_append(r, 'reminder for another user blocked OK'); end;

  -- ===== u3: outsider =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.tasks;
  r := array_append(r, 'outsider sees tasks=' || n || ' (expect 0)');
  select count(*) into n from public.projects;
  r := array_append(r, 'outsider sees projects=' || n || ' (expect 0)');

  -- ===== anon =====
  reset role;
  set local role anon;
  begin select count(*) into n from public.tasks;
    r := array_append(r, 'anon sees tasks=' || n || ' (expect error or 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;
  reset role;

  raise exception E'RLS_TEST_RESULTS\n%', array_to_string(r, E'\n');
end $$;
