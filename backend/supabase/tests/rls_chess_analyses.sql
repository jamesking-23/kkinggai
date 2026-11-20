-- RLS and constraint test for chess_analyses. Rollback-only: ends in `raise exception 'RESULTS: ...'`.
-- Live result (2026-11-20): 13 lines, every check as expected.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  g1 uuid; g2 uuid; a1 uuid; n int; rev int; r text[] := '{}';
  ev jsonb := '[{"white":10,"bestUci":"e2e4","bestSan":"e4","depth":14}]';
begin
  insert into auth.users (id, email) values (u1,'ca-1@test.invalid'),(u2,'ca-2@test.invalid');
  insert into public.chess_games (user_id, source, white, black, result, pgn, move_count)
    values (u1,'pgn','A','B','1-0','1. e4 1-0',1) returning id into g1;
  insert into public.chess_games (user_id, source, white, black, result, pgn, move_count)
    values (u2,'pgn','C','D','1-0','1. d4 1-0',1) returning id into g2;

  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.chess_analyses (game_id, depth, evals) values (g1, 14, ev) returning id into a1;
  r := array_append(r,'owner saved analysis OK');
  begin insert into public.chess_analyses (game_id, depth, evals) values (g1, 14, ev);
    r := array_append(r,'FAIL second live analysis for one game accepted');
  exception when unique_violation then r := array_append(r,'one live analysis per game enforced OK'); end;
  begin insert into public.chess_analyses (game_id, depth, evals) values (g2, 14, ev);
    r := array_append(r,'FAIL analysis on another user''s game accepted');
  exception when others then r := array_append(r,'analysis on foreign game blocked OK'); end;
  begin insert into public.chess_analyses (user_id, game_id, depth, evals) values (u2, g2, 14, ev);
    r := array_append(r,'FAIL spoofed user_id accepted');
  exception when others then r := array_append(r,'spoofed user_id blocked OK'); end;
  update public.chess_analyses set depth = 18 where id = a1;
  select revision into rev from public.chess_analyses where id = a1;
  r := array_append(r,'update OK, revision=' || rev || ' (expect 2)');
  update public.chess_analyses set deleted_at = now() where id = a1;
  insert into public.chess_analyses (game_id, depth, evals) values (g1, 14, ev);
  r := array_append(r,'after soft delete a new analysis is allowed OK');

  reset role;
  begin insert into public.chess_analyses (user_id, game_id, depth, evals) values (u1, g1, 14, '{"a":1}');
    r := array_append(r,'FAIL non-array evals accepted');
  exception when check_violation then r := array_append(r,'non-array evals rejected OK'); end;
  begin insert into public.chess_analyses (user_id, game_id, depth, evals) values (u1, g1, 99, ev);
    r := array_append(r,'FAIL depth 99 accepted');
  exception when check_violation then r := array_append(r,'depth out of range rejected OK'); end;
  begin insert into public.chess_analyses (user_id, game_id, depth, evals) values (u1, g1, 14, '[]');
    r := array_append(r,'FAIL empty evals accepted');
  exception when check_violation then r := array_append(r,'empty evals rejected OK'); end;

  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chess_analyses;
  r := array_append(r,'other user sees analyses=' || n || ' (expect 0)');
  update public.chess_analyses set depth = 1 where game_id = g1;
  reset role;
  select count(*) into n from public.chess_analyses where depth = 1;
  r := array_append(r,'other user changed rows=' || n || ' (expect 0)');

  perform set_config('request.jwt.claims','{}', true);
  set local role anon;
  select count(*) into n from public.chess_analyses;
  r := array_append(r,'anon sees analyses=' || n || ' (expect 0)');
  reset role;
  select count(*) into n from pg_policies where schemaname='public' and tablename='chess_analyses' and cmd='DELETE';
  r := array_append(r,'delete policies=' || n || ' (expect 0)');
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
