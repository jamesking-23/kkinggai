-- Tests module activation rules and the Idea Inbox. Users: u1 owner, u2 member, u3 admin, u4 viewer, u5 outsider.
-- Rolls back via a final exception that carries the results.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  u4 uuid := gen_random_uuid(); u5 uuid := gen_random_uuid();
  ws1 uuid; i1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'm-1@test.invalid'), (u2, 'm-2@test.invalid'), (u3, 'm-3@test.invalid'),
    (u4, 'm-4@test.invalid'), (u5, 'm-5@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (ws1, u2, 'member'), (ws1, u3, 'admin'), (ws1, u4, 'viewer');
  -- A temporary module that depends on 'tasks', to exercise dependency rules.
  insert into public.module_registry (id, name, version, status, dependencies)
    values ('tmp-dep', 'Tmp', '0.0.1', 'active', array['tasks']);
  insert into public.workspace_modules (workspace_id, module_id, enabled) values (ws1, 'tmp-dep', false);

  -- ===== u2: plain member cannot toggle modules =====
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.workspace_modules set enabled = false where workspace_id = ws1 and module_id = 'goals';
  get diagnostics n = row_count;
  r := array_append(r, 'member toggle module rows=' || n || ' (expect 0)');
  select count(*) into n from public.workspace_modules where workspace_id = ws1;
  r := array_append(r, 'member can read ws1 modules=' || (n > 0)::text || ' (expect true)');

  -- ===== u3: admin =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.workspace_modules set enabled = false where workspace_id = ws1 and module_id = 'goals';
  get diagnostics n = row_count;
  r := array_append(r, 'admin disabled goals rows=' || n || ' (expect 1)');
  update public.workspace_modules set enabled = true where workspace_id = ws1 and module_id = 'goals';

  begin update public.workspace_modules set enabled = false where workspace_id = ws1 and module_id = 'dashboard';
    r := array_append(r, 'FAIL core module disabled');
  exception when others then r := array_append(r, 'core module disable blocked OK'); end;

  begin insert into public.workspace_modules (workspace_id, module_id) values (ws1, 'goals');
    r := array_append(r, 'FAIL client inserted workspace_modules row');
  exception when others then r := array_append(r, 'client insert into workspace_modules blocked OK'); end;
  delete from public.workspace_modules where workspace_id = ws1 and module_id = 'goals';
  get diagnostics n = row_count;
  r := array_append(r, 'client delete from workspace_modules rows=' || n || ' (expect 0)');

  -- dependency rules (tmp-dep requires tasks)
  update public.workspace_modules set enabled = true where workspace_id = ws1 and module_id = 'tmp-dep';
  get diagnostics n = row_count;
  r := array_append(r, 'enable dependent module with dependency on rows=' || n || ' (expect 1)');
  begin update public.workspace_modules set enabled = false where workspace_id = ws1 and module_id = 'tasks';
    r := array_append(r, 'FAIL disabled module that another needs');
  exception when others then r := array_append(r, 'disable of required module blocked OK'); end;
  update public.workspace_modules set enabled = false where workspace_id = ws1 and module_id = 'tmp-dep';
  update public.workspace_modules set enabled = false where workspace_id = ws1 and module_id = 'tasks';
  begin update public.workspace_modules set enabled = true where workspace_id = ws1 and module_id = 'tmp-dep';
    r := array_append(r, 'FAIL enabled module with missing dependency');
  exception when others then r := array_append(r, 'enable with missing dependency blocked OK'); end;

  -- ===== Idea Inbox: u1 owner =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.idea_backlog (workspace_id, title, related_module) values (ws1, 'Dark mode', 'dashboard')
    returning id into i1;
  r := array_append(r, 'owner captured an idea OK');
  update public.idea_backlog set status = 'planned' where id = i1;
  select revision into rev from public.idea_backlog where id = i1;
  r := array_append(r, 'idea revision after update=' || rev || ' (expect 2)');
  begin update public.idea_backlog set status = 'bogus' where id = i1;
    r := array_append(r, 'FAIL invalid status accepted');
  exception when others then r := array_append(r, 'invalid idea status blocked OK'); end;
  begin insert into public.idea_backlog (workspace_id, title, related_module) values (ws1, 'x', 'no-such-module');
    r := array_append(r, 'FAIL unknown related module accepted');
  exception when others then r := array_append(r, 'unknown related module blocked OK'); end;
  begin insert into public.idea_backlog (workspace_id, title, created_by) values (ws1, 'spoof', u2);
    r := array_append(r, 'FAIL created_by spoof accepted');
  exception when others then r := array_append(r, 'idea created_by spoof blocked OK'); end;

  -- ===== u4 viewer =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u4, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.idea_backlog where workspace_id = ws1;
  r := array_append(r, 'viewer reads ideas=' || n || ' (expect 1)');
  begin insert into public.idea_backlog (workspace_id, title) values (ws1, 'viewer idea');
    r := array_append(r, 'FAIL viewer captured idea');
  exception when others then r := array_append(r, 'viewer idea insert blocked OK'); end;
  update public.idea_backlog set title = 'hacked' where id = i1; get diagnostics n = row_count;
  r := array_append(r, 'viewer idea update rows=' || n || ' (expect 0)');

  -- ===== u5 outsider =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u5, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.idea_backlog;
  r := array_append(r, 'outsider sees ideas=' || n || ' (expect 0)');
  select count(*) into n from public.workspace_modules where workspace_id = ws1;
  r := array_append(r, 'outsider sees ws1 modules=' || n || ' (expect 0)');

  -- ===== anon =====
  reset role;
  set local role anon;
  begin select count(*) into n from public.idea_backlog;
    r := array_append(r, 'anon sees ideas=' || n || ' (expect error or 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;
  reset role;

  raise exception E'RLS_TEST_RESULTS\n%', array_to_string(r, E'\n');
end $$;
