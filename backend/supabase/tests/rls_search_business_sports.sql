-- Tests that search_workspace returns ventures, chess games and runs only to their owner.
-- Requires migration 20261117000019. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; v1 uuid; n int; kinds text; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 's-1@test.invalid'), (u2, 's-2@test.invalid'), (u3, 's-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ventures (name, description) values ('Zebraquartz farm', 'x') returning id into v1;
  insert into public.chess_games (white, black, opening, pgn) values ('Zebraquartz', 'Opp', 'Italian', '1. e4 *');
  insert into public.run_activities (name, kind, started_at, distance_m, moving_seconds, elapsed_seconds, source)
    values ('Zebraquartz long run', 'long', now(), 10000, 3600, 3700, 'manual');
  select string_agg(kind, ',' order by kind) into kinds from public.search_workspace(ws1, 'zebraquartz');
  r := array_append(r, 'owner hits: ' || coalesce(kinds, 'none') || ' (expect chess_game,run,venture)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'zebraquartz');
  r := array_append(r, 'admin hits=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'zebraquartz');
  r := array_append(r, 'outsider hits=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.search_workspace(ws1, 'zebraquartz');
    r := array_append(r, 'FAIL anon can call search');
  exception when others then r := array_append(r, 'anon call blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
