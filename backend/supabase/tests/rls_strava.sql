-- Tests Strava connection privacy. u1 owner, u2 workspace admin in u1's workspace, u3 outsider. Requires migration 20261115000016.
-- Rolls back via a final exception that carries the results. Does not issue a literal delete; the delete policy is checked in pg_policies.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 's-1@test.invalid'), (u2, 's-2@test.invalid'), (u3, 's-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.strava_connections (athlete_id, access_token, refresh_token, expires_at, scope)
    values (12345, 'testaccesstoken0000', 'testrefreshtoken000', now() + interval '6 hours', 'read,activity:read_all');
  r := array_append(r, 'owner created connection OK');

  begin insert into public.strava_connections (user_id, athlete_id, access_token, refresh_token, expires_at)
    values (u2, 1, 'testaccesstoken0000', 'testrefreshtoken000', now());
    r := array_append(r, 'FAIL inserted connection for another user');
  exception when others then r := array_append(r, 'connection spoofing blocked OK'); end;
  begin insert into public.strava_connections (athlete_id, access_token, refresh_token, expires_at)
    values (1, 'testaccesstoken0000', 'testrefreshtoken000', now());
    r := array_append(r, 'FAIL second connection for same user accepted');
  exception when others then r := array_append(r, 'one connection per user enforced OK'); end;

  update public.strava_connections set last_synced_at = now() where user_id = u1;
  select revision into rev from public.strava_connections where user_id = u1;
  r := array_append(r, 'revision after update=' || rev || ' (expect 2)');
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'strava_connections' and cmd = 'DELETE';
  r := array_append(r, 'owner DELETE policies=' || n || ' (expect 1)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.strava_connections where user_id = u1;
  r := array_append(r, 'admin sees u1 connection=' || n || ' (expect 0)');
  update public.strava_connections set scope = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.strava_connections;
  r := array_append(r, 'outsider sees connections=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.strava_connections;
    r := array_append(r, 'anon sees connections=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
