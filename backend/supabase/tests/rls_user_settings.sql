-- user_settings RLS as used by the board-preference sync. Rollback-only. Live result (2026-11-21): 4 lines, all as expected
-- (owner updates own row; another user sees 0 rows and updates 0; anon sees 0).
do $$
declare u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); n int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1,'bs-1@test.invalid'),(u2,'bs-2@test.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;
  update public.user_settings set settings = '{"board":{"at":1,"prefs":{}}}'::jsonb where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r,'owner updated own settings rows=' || n || ' (expect 1)');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.user_settings where user_id = u1;
  r := array_append(r,'other user sees rows=' || n || ' (expect 0)');
  update public.user_settings set settings = '{"x":1}'::jsonb where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r,'other user updated rows=' || n || ' (expect 0)');
  reset role;
  set local role anon;
  select count(*) into n from public.user_settings;
  r := array_append(r,'anon sees rows=' || n || ' (expect 0)');
  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
