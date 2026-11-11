-- Tests running privacy and constraints. u1 owner, u2 workspace admin in u1's workspace, u3 outsider. Requires migration 20261112000014.
-- Rolls back via a final exception that carries the results. Non-destructive (no literal delete statements).
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; a1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'r-1@test.invalid'), (u2, 'r-2@test.invalid'), (u3, 'r-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.run_activities (source, external_id, name, started_at, distance_m, moving_seconds, elapsed_seconds, route)
    values ('gpx', 'k1', 'Morning run', now(), 5000, 1500, 1600, '[[0.1,32.5],[0.2,32.6]]'::jsonb) returning id into a1;
  r := array_append(r, 'owner created activity OK');

  begin insert into public.run_activities (user_id, name, started_at, distance_m, moving_seconds) values (u2, 'x', now(), 1000, 300);
    r := array_append(r, 'FAIL inserted activity for another user');
  exception when others then r := array_append(r, 'activity spoofing blocked OK'); end;
  begin insert into public.run_activities (source, external_id, name, started_at, distance_m, moving_seconds) values ('gpx', 'k1', 'dup', now(), 1000, 300);
    r := array_append(r, 'FAIL duplicate external id accepted');
  exception when others then r := array_append(r, 'duplicate external id blocked OK'); end;
  begin insert into public.run_activities (name, started_at, distance_m, moving_seconds) values ('x', now(), 0, 300);
    r := array_append(r, 'FAIL zero distance accepted');
  exception when others then r := array_append(r, 'zero distance blocked OK'); end;
  begin insert into public.run_activities (name, started_at, distance_m, moving_seconds, elapsed_seconds) values ('x', now(), 1000, 400, 300);
    r := array_append(r, 'FAIL moving > elapsed accepted');
  exception when others then r := array_append(r, 'moving > elapsed blocked OK'); end;
  begin insert into public.run_activities (name, started_at, distance_m, moving_seconds, kind) values ('x', now(), 1000, 300, 'swim');
    r := array_append(r, 'FAIL invalid kind accepted');
  exception when others then r := array_append(r, 'invalid kind blocked OK'); end;
  begin insert into public.run_activities (name, started_at, distance_m, moving_seconds, route)
    select 'x', now(), 1000, 300, jsonb_agg(jsonb_build_array(0, 0)) from generate_series(1, 601);
    r := array_append(r, 'FAIL oversized route accepted');
  exception when others then r := array_append(r, 'oversized route blocked OK'); end;
  begin insert into public.run_activities (name, started_at, distance_m, moving_seconds, route) values ('x', now(), 1000, 300, '{"a":1}'::jsonb);
    r := array_append(r, 'FAIL non-array route accepted');
  exception when others then r := array_append(r, 'non-array route blocked OK'); end;

  update public.run_activities set notes = 'felt good' where id = a1;
  select revision into rev from public.run_activities where id = a1;
  r := array_append(r, 'revision after update=' || rev || ' (expect 2)');
  update public.run_activities set deleted_at = now() where id = a1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'run_activities' and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies on run_activities=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.run_activities where user_id = u1;
  r := array_append(r, 'admin sees u1 activities=' || n || ' (expect 0)');
  update public.run_activities set name = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.run_activities;
  r := array_append(r, 'outsider sees activities=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.run_activities;
    r := array_append(r, 'anon sees activities=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
