-- Tests chess puzzle privacy. u1 owner, u2 workspace admin in u1's workspace, u3 outsider. Requires migration 20261112000013.
-- Rolls back via a final exception that carries the results. Non-destructive (no literal delete statements).
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; g1 uuid; g2 uuid; p1 uuid; n int; rev int; r text[] := '{}';
  fen text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  insert into auth.users (id, email) values (u1, 'p-1@test.invalid'), (u2, 'p-2@test.invalid'), (u3, 'p-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.chess_games (white, black, pgn) values ('a', 'b', '1. e4 *') returning id into g2;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.chess_games (white, black, pgn) values ('Me', 'Opp', '1. e4 e5 *') returning id into g1;
  insert into public.chess_puzzles (game_id, ply, fen, side_to_move, solution_uci, played_uci, loss_cp)
    values (g1, 1, fen, 'white', 'e2e4', 'a2a3', 120) returning id into p1;
  r := array_append(r, 'owner created puzzle OK');

  begin insert into public.chess_puzzles (game_id, ply, fen, side_to_move, solution_uci, played_uci, loss_cp)
    values (g1, 1, fen, 'white', 'd2d4', 'a2a3', 100);
    r := array_append(r, 'FAIL duplicate game/ply accepted');
  exception when others then r := array_append(r, 'duplicate game/ply blocked OK'); end;
  begin insert into public.chess_puzzles (game_id, ply, fen, side_to_move, solution_uci, played_uci, loss_cp)
    values (g2, 1, fen, 'white', 'e2e4', 'a2a3', 100);
    r := array_append(r, 'FAIL puzzle linked to another user game');
  exception when others then r := array_append(r, 'cross-user game link blocked OK'); end;
  begin insert into public.chess_puzzles (user_id, game_id, ply, fen, side_to_move, solution_uci, played_uci, loss_cp)
    values (u2, g1, 2, fen, 'white', 'e2e4', 'a2a3', 100);
    r := array_append(r, 'FAIL inserted puzzle for another user');
  exception when others then r := array_append(r, 'puzzle spoofing blocked OK'); end;
  begin insert into public.chess_puzzles (game_id, ply, fen, side_to_move, solution_uci, played_uci, loss_cp)
    values (g1, 3, fen, 'white', 'e2e9', 'a2a3', 100);
    r := array_append(r, 'FAIL invalid uci accepted');
  exception when others then r := array_append(r, 'invalid uci blocked OK'); end;
  begin update public.chess_puzzles set attempts = 1, correct = 2 where id = p1;
    r := array_append(r, 'FAIL correct > attempts accepted');
  exception when others then r := array_append(r, 'correct > attempts blocked OK'); end;

  update public.chess_puzzles set attempts = 1, correct = 1, box = 1 where id = p1;
  select revision into rev from public.chess_puzzles where id = p1;
  r := array_append(r, 'puzzle revision after update=' || rev || ' (expect 2)');
  update public.chess_puzzles set deleted_at = now() where id = p1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'chess_puzzles' and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies on chess_puzzles=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chess_puzzles where user_id = u1;
  r := array_append(r, 'admin sees u1 puzzles=' || n || ' (expect 0)');
  update public.chess_puzzles set loss_cp = 1 where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.chess_puzzles;
  r := array_append(r, 'outsider sees puzzles=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.chess_puzzles;
    r := array_append(r, 'anon sees puzzles=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
