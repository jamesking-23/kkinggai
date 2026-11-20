-- RLS and constraint test for run_profiles and run_activities.hr_buckets. Rollback-only (ends in raise exception).
-- Live result (2026-11-20): 12 lines, every check as expected.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  n int; r text[] := '{}'; rid uuid;
begin
  insert into auth.users (id, email) values (u1,'hz-1@test.invalid'),(u2,'hz-2@test.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.run_profiles (max_hr) values (190);
  r := array_append(r,'owner created profile OK');
  begin insert into public.run_profiles (max_hr) values (180);
    r := array_append(r,'FAIL second profile row accepted');
  exception when unique_violation then r := array_append(r,'one profile per user OK'); end;
  begin insert into public.run_profiles (user_id, max_hr) values (u2, 190);
    r := array_append(r,'FAIL spoofed user_id accepted');
  exception when others then r := array_append(r,'spoofed user_id blocked OK'); end;
  begin update public.run_profiles set max_hr = 400;
    r := array_append(r,'FAIL max_hr 400 accepted');
  exception when check_violation then r := array_append(r,'max_hr out of range rejected OK'); end;
  update public.run_profiles set max_hr = 188;
  select max_hr into n from public.run_profiles;
  r := array_append(r,'owner update OK, max_hr=' || n || ' (expect 188)');
  insert into public.run_activities (name, started_at, distance_m, moving_seconds, hr_buckets)
    values ('t', now(), 5000, 1800, '{"140":300,"145":420}') returning id into rid;
  r := array_append(r,'run with hr_buckets saved OK');
  begin insert into public.run_activities (name, started_at, distance_m, moving_seconds, hr_buckets)
      values ('t2', now(), 5000, 1800, '[1,2]');
    r := array_append(r,'FAIL array hr_buckets accepted');
  exception when check_violation then r := array_append(r,'non-object hr_buckets rejected OK'); end;
  begin insert into public.run_activities (name, started_at, distance_m, moving_seconds, hr_buckets)
      values ('t3', now(), 5000, 1800, jsonb_build_object('x', repeat('a', 2500)));
    r := array_append(r,'FAIL oversized hr_buckets accepted');
  exception when check_violation then r := array_append(r,'oversized hr_buckets rejected OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.run_profiles;
  r := array_append(r,'other user sees profiles=' || n || ' (expect 0)');
  update public.run_profiles set max_hr = 100;
  reset role;
  select max_hr into n from public.run_profiles where user_id = u1;
  r := array_append(r,'other user changed max_hr? now ' || n || ' (expect 188)');
  perform set_config('request.jwt.claims','{}', true);
  set local role anon;
  select count(*) into n from public.run_profiles;
  r := array_append(r,'anon sees profiles=' || n || ' (expect 0)');
  reset role;
  select count(*) into n from pg_policies where schemaname='public' and tablename='run_profiles' and cmd='DELETE';
  r := array_append(r,'delete policies=' || n || ' (expect 0)');
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
