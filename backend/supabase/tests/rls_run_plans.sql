-- Tests running plan privacy and constraints. u1 owner, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261115000015. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; p1 uuid; p2 uuid; s1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'q-1@test.invalid'), (u2, 'q-2@test.invalid'), (u3, 'q-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.run_plans (name, goal, race_date, start_date, days_per_week, start_weekly_km, weeks)
    values ('theirs', '10k', '2027-03-01', '2026-11-16', 4, 20, 15) returning id into p2;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.run_plans (name, goal, race_date, start_date, days_per_week, start_weekly_km, weeks)
    values ('Half in Feb', 'half', '2027-02-14', '2026-11-16', 4, 25, 13) returning id into p1;
  insert into public.run_plan_sessions (plan_id, week, planned_on, kind, distance_m, description)
    values (p1, 1, '2026-11-17', 'easy', 5000, 'Easy run') returning id into s1;
  r := array_append(r, 'owner created plan and session OK');

  begin insert into public.run_plans (user_id, name, goal, race_date, start_date, days_per_week, start_weekly_km, weeks)
    values (u2, 'x', '5k', '2027-03-01', '2026-11-16', 3, 10, 15);
    r := array_append(r, 'FAIL inserted plan for another user');
  exception when others then r := array_append(r, 'plan spoofing blocked OK'); end;
  begin insert into public.run_plan_sessions (plan_id, week, planned_on, kind, distance_m, description)
    values (p2, 1, '2026-11-17', 'easy', 5000, 'session on another users plan');
    r := array_append(r, 'FAIL session added to another user plan');
  exception when others then r := array_append(r, 'cross-user plan link blocked OK'); end;
  begin insert into public.run_plans (name, goal, race_date, start_date, days_per_week, start_weekly_km, weeks)
    values ('x', 'ultra', '2027-03-01', '2026-11-16', 3, 10, 15);
    r := array_append(r, 'FAIL invalid goal accepted');
  exception when others then r := array_append(r, 'invalid goal blocked OK'); end;
  begin insert into public.run_plans (name, goal, race_date, start_date, days_per_week, start_weekly_km, weeks)
    values ('x', '5k', '2026-11-01', '2026-11-16', 3, 10, 15);
    r := array_append(r, 'FAIL race before start accepted');
  exception when others then r := array_append(r, 'race-before-start blocked OK'); end;
  begin insert into public.run_plans (name, goal, race_date, start_date, days_per_week, start_weekly_km, weeks)
    values ('x', '5k', '2027-03-01', '2026-11-16', 7, 10, 15);
    r := array_append(r, 'FAIL 7 days a week accepted');
  exception when others then r := array_append(r, 'days_per_week bounds blocked OK'); end;
  begin insert into public.run_plan_sessions (plan_id, week, planned_on, kind, distance_m, description)
    values (p1, 1, '2026-11-18', 'swim', 5000, 'x');
    r := array_append(r, 'FAIL invalid kind accepted');
  exception when others then r := array_append(r, 'invalid session kind blocked OK'); end;

  update public.run_plan_sessions set status = 'done' where id = s1;
  select revision into rev from public.run_plan_sessions where id = s1;
  r := array_append(r, 'session revision after update=' || rev || ' (expect 2)');
  update public.run_plans set status = 'archived' where id = p1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner archive rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename in ('run_plans','run_plan_sessions') and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies on plan tables=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.run_plans where user_id = u1;
  r := array_append(r, 'admin sees u1 plans=' || n || ' (expect 0)');
  select count(*) into n from public.run_plan_sessions where user_id = u1;
  r := array_append(r, 'admin sees u1 sessions=' || n || ' (expect 0)');
  update public.run_plan_sessions set status = 'skipped' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.run_plans;
  r := array_append(r, 'outsider sees plans=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.run_plans;
    r := array_append(r, 'anon sees plans=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
