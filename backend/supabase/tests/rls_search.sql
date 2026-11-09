-- Tests universal search. Users: u1 owner with data, u2 admin of u1's workspace, u3 outsider.
-- Requires migration 20261109000007. Rolls back via a final exception that carries the results.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; n int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 's-1@test.invalid'), (u2, 's-2@test.invalid'), (u3, 's-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.tasks (workspace_id, title, description) values (ws1, 'Quarterly report', 'budget 100%_done');
  insert into public.tasks (workspace_id, title, deleted_at) values (ws1, 'Quarterly deleted task', now());
  insert into public.projects (workspace_id, name) values (ws1, 'Quarterly planning');
  insert into public.vault_items (kind, title, body) values ('note', 'Quarterly passport note', 'x');
  insert into public.ai_conversations (workspace_id, title) values (ws1, 'Quarterly chat');

  select count(*) into n from public.search_workspace(ws1, 'quarterly');
  r := array_append(r, 'owner finds quarterly=' || n || ' (expect 4: task, project, vault, conversation)');
  select count(*) into n from public.search_workspace(ws1, 'QUARTERLY deleted');
  r := array_append(r, 'soft-deleted task hidden=' || n || ' (expect 0)');
  select count(*) into n from public.search_workspace(ws1, 'x');
  r := array_append(r, 'one-character query rows=' || n || ' (expect 0)');
  select count(*) into n from public.search_workspace(ws1, '%%');
  r := array_append(r, 'wildcard %% rows=' || n || ' (expect 0)');
  select count(*) into n from public.search_workspace(ws1, 'r_');
  r := array_append(r, 'underscore literal rows=' || n || ' (expect 0)');
  select count(*) into n from public.search_workspace(ws1, '100%_');
  r := array_append(r, 'literal 100%_ matches description rows=' || n || ' (expect 1)');
  select count(*) into n from public.search_workspace(ws1, 'quarterly', 1);
  r := array_append(r, 'per_kind=1 rows=' || n || ' (expect 4, one per kind)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'quarterly');
  r := array_append(r, 'admin finds shared quarterly=' || n || ' (expect 2: task, project; not vault or chat)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'quarterly');
  r := array_append(r, 'outsider searching foreign workspace=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform * from public.search_workspace(ws1, 'quarterly');
    r := array_append(r, 'FAIL anon executed search');
  exception when others then r := array_append(r, 'anon execute blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
