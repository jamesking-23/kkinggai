-- Tests rematch invitations. Users: u1 and u2 played, u3 outsider. Requires migrations 026 and 028. Rolled back; non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  g1 uuid; g2 uuid; c2 text; rm uuid; rm2 uuid; code text; n int; st text; w uuid; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'rm-1@test.invalid'), (u2, 'rm-2@test.invalid'), (u3, 'rm-3@test.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select c.id, c.invite_code into g1, code from public.mp_create('white') c;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_join(code);
  begin perform public.mp_rematch(g1);
    r := array_append(r, 'FAIL rematch of a game with no moves');
  exception when others then r := array_append(r, 'rematch before any move blocked OK'); end;
  perform public.mp_move(g1, 0, 'e2e4');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.mp_rematch(g1);
    r := array_append(r, 'FAIL outsider offered a rematch');
  exception when others then r := array_append(r, 'outsider rematch blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_resign(g1);
  rm := public.mp_rematch(g1);
  r := array_append(r, 'u2 (black) offered a rematch OK');
  select white_id into w from public.mp_games where id = rm;
  r := array_append(r, 'u2 plays white in the rematch=' || (w = u2) || ' (expect true: colours swapped)');
  begin perform public.mp_rematch(g1);
    r := array_append(r, 'FAIL second rematch offered');
  exception when others then r := array_append(r, 'second open rematch blocked OK'); end;
  begin perform public.mp_accept(rm);
    r := array_append(r, 'FAIL creator accepted own invitation');
  exception when others then r := array_append(r, 'self-accept blocked OK'); end;
  begin perform public.mp_move(rm, 0, 'e2e4');
    r := array_append(r, 'FAIL move before acceptance');
  exception when others then r := array_append(r, 'move before acceptance blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.mp_games where id = rm;
  r := array_append(r, 'outsider sees the invitation=' || n || ' (expect 0)');
  begin perform public.mp_accept(rm);
    r := array_append(r, 'FAIL outsider accepted');
  exception when others then r := array_append(r, 'outsider accept blocked OK'); end;
  begin perform public.mp_decline(rm);
    r := array_append(r, 'FAIL outsider declined');
  exception when others then r := array_append(r, 'outsider decline blocked OK'); end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.mp_games where id = rm;
  r := array_append(r, 'invited user sees the waiting game=' || n || ' (expect 1)');
  perform public.mp_accept(rm);
  select status into st from public.mp_games where id = rm;
  r := array_append(r, 'status after accept=' || st || ' (expect active)');
  select count(*) into n from public.mp_games where id = rm and black_id = u1 and white_id = u2 and invited_id is null;
  r := array_append(r, 'seats correct after accept=' || n || ' (expect 1)');
  begin perform public.mp_move(rm, 0, 'd2d4');
    r := array_append(r, 'FAIL black moved first');
  exception when others then r := array_append(r, 'black cannot move first OK'); end;

  -- decline path
  select c.id, c.invite_code into g2, c2 from public.mp_create('white') c;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_join(c2);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_move(g2, 0, 'e2e4');
  rm2 := public.mp_rematch(g2);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mp_decline(rm2);
  select count(*) into n from public.mp_games where id = rm2;
  r := array_append(r, 'decliner no longer sees the cancelled invitation=' || n || ' (expect 0)');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select status into st from public.mp_games where id = rm2;
  r := array_append(r, 'status after decline=' || st || ' (expect cancelled)');
  perform public.mp_rematch(g2);
  r := array_append(r, 'new rematch allowed after a declined one OK');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform public.mp_rematch(g2);
    r := array_append(r, 'FAIL anon rematch');
  exception when others then r := array_append(r, 'anon rematch blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
