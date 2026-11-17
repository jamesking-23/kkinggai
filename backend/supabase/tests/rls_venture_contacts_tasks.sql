-- Tests privacy of venture contacts and tasks. Users: u1 owner, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261117000020. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; v1 uuid; v2 uuid; c1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'vc-1@test.invalid'), (u2, 'vc-2@test.invalid'), (u3, 'vc-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ventures (name) values ('Other') returning id into v2;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ventures (name) values ('Mine') returning id into v1;
  insert into public.venture_contacts (venture_id, name, role, email) values (v1, 'Supplier Co', 'supplier', 'a@b.co') returning id into c1;
  insert into public.venture_tasks (venture_id, title, due_on) values (v1, 'Register business', current_date);
  r := array_append(r, 'owner created contact and task OK');

  begin insert into public.venture_contacts (user_id, venture_id, name) values (u2, v1, 'spoof');
    r := array_append(r, 'FAIL contact for another user');
  exception when others then r := array_append(r, 'contact spoofing blocked OK'); end;
  begin insert into public.venture_tasks (venture_id, title) values (v2, 'linked to other venture');
    r := array_append(r, 'FAIL task linked to another user venture');
  exception when others then r := array_append(r, 'cross-user task link blocked OK'); end;
  begin insert into public.venture_contacts (venture_id, name) values (v2, 'linked to other venture');
    r := array_append(r, 'FAIL contact linked to another user venture');
  exception when others then r := array_append(r, 'cross-user contact link blocked OK'); end;
  begin insert into public.venture_contacts (venture_id, name, role) values (v1, 'x', 'boss');
    r := array_append(r, 'FAIL invalid role accepted');
  exception when others then r := array_append(r, 'invalid role blocked OK'); end;
  begin insert into public.venture_contacts (venture_id, name, email) values (v1, 'x', 'not-an-email');
    r := array_append(r, 'FAIL invalid email accepted');
  exception when others then r := array_append(r, 'invalid email blocked OK'); end;
  begin insert into public.venture_tasks (venture_id, title, status) values (v1, 'x', 'blocked');
    r := array_append(r, 'FAIL invalid status accepted');
  exception when others then r := array_append(r, 'invalid status blocked OK'); end;

  update public.venture_contacts set notes = 'called' where id = c1;
  select revision into rev from public.venture_contacts where id = c1;
  r := array_append(r, 'contact revision after update=' || rev || ' (expect 2)');
  update public.venture_contacts set deleted_at = now() where id = c1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename in ('venture_contacts','venture_tasks') and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.venture_contacts where user_id = u1;
  r := array_append(r, 'admin sees u1 contacts=' || n || ' (expect 0)');
  select count(*) into n from public.venture_tasks where user_id = u1;
  r := array_append(r, 'admin sees u1 tasks=' || n || ' (expect 0)');
  update public.venture_tasks set title = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.venture_tasks;
  r := array_append(r, 'outsider sees tasks=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.venture_contacts;
    r := array_append(r, 'anon sees contacts=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
