-- Tests chess privacy. Users: u1 owner, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261110000012. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; g1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'c-1@test.invalid'), (u2, 'c-2@test.invalid'), (u3, 'c-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.chess_profiles (player_names, lichess_username) values (array['Me'], 'some_user');
  insert into public.chess_games (source, external_id, white, black, result, pgn, move_count)
    values ('pgn', 'x1', 'Me', 'Opp', '1-0', '1. e4 e5 1-0', 2) returning id into g1;
  r := array_append(r, 'owner created profile and game OK');

  begin insert into public.chess_games (user_id, white, black, pgn) values (u2, 'a', 'b', '1. e4 *');
    r := array_append(r, 'FAIL inserted game for another user');
  exception when others then r := array_append(r, 'game spoofing blocked OK'); end;
  begin insert into public.chess_profiles (user_id) values (u2);
    r := array_append(r, 'FAIL inserted profile for another user');
  exception when others then r := array_append(r, 'profile spoofing blocked OK'); end;
  begin insert into public.chess_games (source, external_id, white, black, pgn) values ('pgn', 'x1', 'a', 'b', '1. e4 *');
    r := array_append(r, 'FAIL duplicate external id accepted');
  exception when others then r := array_append(r, 'duplicate external id blocked OK'); end;
  begin insert into public.chess_games (result, pgn) values ('2-0', '1. e4 *');
    r := array_append(r, 'FAIL invalid result accepted');
  exception when others then r := array_append(r, 'invalid result blocked OK'); end;
  begin insert into public.chess_games (pgn) values ('');
    r := array_append(r, 'FAIL empty pgn accepted');
  exception when others then r := array_append(r, 'empty pgn blocked OK'); end;
  begin insert into public.chess_games (pgn, source) values ('1. e4 *', 'evil');
    r := array_append(r, 'FAIL invalid source accepted');
  exception when others then r := array_append(r, 'invalid source blocked OK'); end;

  update public.chess_games set notes = 'good game' where id = g1;
  select revision into rev from public.chess_games where id = g1;
  r := array_append(r, 'game revision after update=' || rev || ' (expect 2)');
  update public.chess_games set deleted_at = now() where id = g1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename in ('chess_games','chess_profiles') and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies on chess tables=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chess_games where user_id = u1;
  r := array_append(r, 'admin sees u1 games=' || n || ' (expect 0)');
  select count(*) into n from public.chess_profiles where user_id = u1;
  r := array_append(r, 'admin sees u1 profile=' || n || ' (expect 0)');
  update public.chess_games set notes = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chess_games;
  r := array_append(r, 'outsider sees games=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.chess_games;
    r := array_append(r, 'anon sees games=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
