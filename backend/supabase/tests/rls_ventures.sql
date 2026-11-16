-- Tests venture privacy. Users: u1 owner, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261117000018. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; v1 uuid; v2 uuid; e1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'v-1@test.invalid'), (u2, 'v-2@test.invalid'), (u3, 'v-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ventures (name) values ('Other venture') returning id into v2;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ventures (name, stage, currency) values ('Poultry', 'building', 'UGX') returning id into v1;
  insert into public.venture_entries (venture_id, kind, amount, category) values (v1, 'expense', 150000.50, 'feed') returning id into e1;
  r := array_append(r, 'owner created venture and entry OK');

  begin insert into public.ventures (user_id, name) values (u2, 'spoof');
    r := array_append(r, 'FAIL inserted venture for another user');
  exception when others then r := array_append(r, 'venture spoofing blocked OK'); end;
  begin insert into public.venture_entries (venture_id, kind, amount) values (v2, 'income', 10);
    r := array_append(r, 'FAIL entry linked to another user venture');
  exception when others then r := array_append(r, 'cross-user venture link blocked OK'); end;
  begin insert into public.venture_entries (venture_id, kind, amount) values (v1, 'income', 0);
    r := array_append(r, 'FAIL zero amount accepted');
  exception when others then r := array_append(r, 'zero amount blocked OK'); end;
  begin insert into public.venture_entries (venture_id, kind, amount) values (v1, 'gift', 5);
    r := array_append(r, 'FAIL invalid kind accepted');
  exception when others then r := array_append(r, 'invalid kind blocked OK'); end;
  begin insert into public.ventures (name, stage) values ('x', 'booming');
    r := array_append(r, 'FAIL invalid stage accepted');
  exception when others then r := array_append(r, 'invalid stage blocked OK'); end;
  begin insert into public.ventures (name, currency) values ('x', 'ugx');
    r := array_append(r, 'FAIL invalid currency accepted');
  exception when others then r := array_append(r, 'invalid currency blocked OK'); end;
  begin insert into public.ventures (name, website) values ('x', 'javascript:alert(1)');
    r := array_append(r, 'FAIL non-http website accepted');
  exception when others then r := array_append(r, 'non-http website blocked OK'); end;

  update public.ventures set stage = 'launched' where id = v1;
  select revision into rev from public.ventures where id = v1;
  r := array_append(r, 'venture revision after update=' || rev || ' (expect 2)');
  update public.venture_entries set deleted_at = now() where id = e1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename in ('ventures','venture_entries') and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies on venture tables=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.ventures where user_id = u1;
  r := array_append(r, 'admin sees u1 ventures=' || n || ' (expect 0)');
  select count(*) into n from public.venture_entries where user_id = u1;
  r := array_append(r, 'admin sees u1 entries=' || n || ' (expect 0)');
  update public.ventures set name = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.ventures;
  r := array_append(r, 'outsider sees ventures=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.venture_entries;
    r := array_append(r, 'anon sees entries=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
