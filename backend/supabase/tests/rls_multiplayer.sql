-- Tests multiplayer chess access and the move/resign/draw functions. Users: u1 creator, u2 joiner, u3 outsider.
-- Requires migration 20261117000026. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  g1 uuid; g2 uuid; code text; code2 text; n int; st text; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'mp-1@test.invalid'), (u2, 'mp-2@test.invalid'), (u3, 'mp-3@test.invalid');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select c.id, c.invite_code into g1, code from public.mp_create('white') c;
  r := array_append(r, 'creator made a game, code length=' || char_length(code) || ' (expect 32)');
  begin perform public.mp_create('green');
    r := array_append(r, 'FAIL invalid colour accepted');
  exception when others then r := array_append(r, 'invalid colour blocked OK'); end;
  begin perform public.mp_join(code);
    r := array_append(r, 'FAIL creator joined own game');
  exception when others then r := array_append(r, 'own-game join blocked OK'); end;
  begin perform public.mp_move(g1, 0, 'e2e4');
    r := array_append(r, 'FAIL move before opponent joined');
  exception when others then r := array_append(r, 'move while waiting blocked OK'); end;
  begin insert into public.mp_games (creator_id, white_id) values (u1, u1);
    r := array_append(r, 'FAIL direct insert allowed');
  exception when others then r := array_append(r, 'direct insert blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.mp_games;
  r := array_append(r, 'outsider sees games before join=' || n || ' (expect 0, invite code not readable)');
  begin perform public.mp_join('00000000000000000000000000000000');
    r := array_append(r, 'FAIL joined with a wrong code');
  exception when others then r := array_append(r, 'wrong code blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_join(code);
  r := array_append(r, 'joiner joined OK');
  select status into st from public.mp_games where id = g1;
  r := array_append(r, 'status after join=' || st || ' (expect active)');
  select count(*) into n from public.mp_games where invite_code is not null;
  r := array_append(r, 'invite code cleared after join, rows with code=' || n || ' (expect 0)');

  begin perform public.mp_move(g1, 0, 'e2e4');
    r := array_append(r, 'FAIL black moved first');
  exception when others then r := array_append(r, 'out-of-turn move blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.mp_join(code);
    r := array_append(r, 'FAIL third player joined a taken game');
  exception when others then r := array_append(r, 'taken game join blocked OK'); end;
  select count(*) into n from public.mp_games;
  r := array_append(r, 'outsider sees games after join=' || n || ' (expect 0)');
  begin perform public.mp_move(g1, 0, 'e2e4');
    r := array_append(r, 'FAIL outsider moved');
  exception when others then r := array_append(r, 'outsider move blocked OK'); end;
  begin perform public.mp_resign(g1);
    r := array_append(r, 'FAIL outsider resigned');
  exception when others then r := array_append(r, 'outsider resign blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.mp_move(g1, 0, 'e2e9');
    r := array_append(r, 'FAIL malformed move accepted');
  exception when others then r := array_append(r, 'malformed move blocked OK'); end;
  begin perform public.mp_move(g1, 3, 'e2e4');
    r := array_append(r, 'FAIL wrong ply accepted');
  exception when others then r := array_append(r, 'wrong ply blocked OK'); end;
  select public.mp_move(g1, 0, 'e2e4') into n;
  r := array_append(r, 'white e2e4 -> ply ' || n || ' (expect 1)');
  begin perform public.mp_move(g1, 1, 'd2d4');
    r := array_append(r, 'FAIL white moved twice');
  exception when others then r := array_append(r, 'double move blocked OK'); end;
  begin update public.mp_games set moves = '{}' where id = g1;
    get diagnostics n = row_count;
    r := array_append(r, 'direct update rows=' || n || ' (expect error or 0)');
  exception when others then r := array_append(r, 'direct update blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.mp_move(g1, 1, 'e7e5') into n;
  r := array_append(r, 'black e7e5 -> ply ' || n || ' (expect 2)');
  begin perform public.mp_move(g1, 1, 'g8f6');
    r := array_append(r, 'FAIL stale ply accepted');
  exception when others then r := array_append(r, 'stale ply blocked OK'); end;
  perform public.mp_draw(g1, 'offer');
  begin perform public.mp_draw(g1, 'accept');
    r := array_append(r, 'FAIL accepted own draw offer');
  exception when others then r := array_append(r, 'own draw accept blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_draw(g1, 'accept');
  select status into st from public.mp_games where id = g1;
  r := array_append(r, 'status after accepted draw=' || st || ' (expect draw)');
  begin perform public.mp_move(g1, 2, 'g1f3');
    r := array_append(r, 'FAIL move after game ended');
  exception when others then r := array_append(r, 'move after end blocked OK'); end;

  select c.id, c.invite_code into g2, code2 from public.mp_create('black') c;
  perform public.mp_resign(g2);
  select status into st from public.mp_games where id = g2;
  r := array_append(r, 'waiting game cancelled by creator=' || st || ' (expect cancelled)');
  select c.id, c.invite_code into g2, code2 from public.mp_create('black') c;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_join(code2);
  select (white_id = u2)::text into st from public.mp_games where id = g2;
  r := array_append(r, 'joiner of a black-creator game plays white=' || st || ' (expect true)');
  perform public.mp_resign(g2);
  select status || '/' || (resigned_by = u2)::text into st from public.mp_games where id = g2;
  r := array_append(r, 'resigned=' || st || ' (expect resigned/true)');

  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'mp_games' and cmd in ('INSERT','UPDATE','DELETE','ALL');
  r := array_append(r, 'write policies on mp_games=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform public.mp_create('white');
    r := array_append(r, 'FAIL anon created a game');
  exception when others then r := array_append(r, 'anon create blocked OK'); end;
  begin select count(*) into n from public.mp_games;
    r := array_append(r, 'anon sees games=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
