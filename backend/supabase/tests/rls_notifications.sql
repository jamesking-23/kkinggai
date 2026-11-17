-- Tests notification generation and privacy. Users: u1 owner of data, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261117000024. Rolls back via a final exception that carries the results. Non-destructive.
-- Note: generate_notifications() also runs for real users inside this transaction; everything is rolled back.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; g1 uuid; v1 uuid; nid uuid; n int; kinds text; r text[] := '{}';
  t date := (now() at time zone 'UTC')::date;
  tm date := ((now() at time zone 'UTC')::date + 1);
  fen text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  insert into auth.users (id, email) values (u1, 'nt-1@test.invalid'), (u2, 'nt-2@test.invalid'), (u3, 'nt-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.important_dates (title, kind, month, day) values ('Mum birthday', 'birthday', extract(month from tm)::int, extract(day from tm)::int);
  insert into public.important_dates (title, kind, month, day) values ('Far away', 'other', extract(month from t + 40)::int, extract(day from t + 40)::int);
  insert into public.job_applications (company, role, status, deadline) values ('Acme', 'Engineer', 'wishlist', t);
  insert into public.job_applications (company, role, status, deadline) values ('Done Co', 'Engineer', 'applied', t);
  insert into public.ventures (name) values ('V') returning id into v1;
  insert into public.venture_tasks (venture_id, title, due_on) values (v1, 'File papers', t);
  insert into public.venture_tasks (venture_id, title, due_on, status) values (v1, 'Already done', t, 'done');
  insert into public.chess_games (white, black, pgn) values ('Me', 'Opp', '1. e4 e5 *') returning id into g1;
  insert into public.chess_puzzles (game_id, ply, fen, side_to_move, solution_uci, played_uci, loss_cp)
    values (g1, 1, fen, 'white', 'e2e4', 'a2a3', 120);
  insert into public.reminders (workspace_id, message, remind_at) values (ws1, 'Call the bank', now() - interval '1 minute');
  insert into public.reminders (workspace_id, message, remind_at) values (ws1, 'Future reminder', now() + interval '2 days');

  begin perform public.generate_notifications();
    r := array_append(r, 'FAIL authenticated can run the generator');
  exception when others then r := array_append(r, 'generator not callable by users OK'); end;

  reset role;
  perform public.generate_notifications();
  perform public.generate_notifications();

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select string_agg(kind, ',' order by kind) into kinds from public.notifications;
  r := array_append(r, 'owner kinds: ' || coalesce(kinds, 'none') || ' (expect application,date,puzzles,reminder,venture_task)');
  select count(*) into n from public.notifications;
  r := array_append(r, 'owner notifications after two runs=' || n || ' (expect 5, no duplicates)');
  select id into nid from public.notifications where kind = 'date';
  update public.notifications set read_at = now() where id = nid;
  get diagnostics n = row_count;
  r := array_append(r, 'owner mark read rows=' || n || ' (expect 1)');
  begin update public.notifications set title = 'edited' where id = nid;
    r := array_append(r, 'FAIL owner edited a title');
  exception when others then r := array_append(r, 'owner cannot edit title OK'); end;
  begin insert into public.notifications (user_id, kind, title, dedupe_key) values (u1, 'date', 'fake', 'fake');
    r := array_append(r, 'FAIL owner inserted a notification');
  exception when others then r := array_append(r, 'owner cannot insert OK'); end;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd in ('DELETE','ALL','INSERT');
  r := array_append(r, 'DELETE/INSERT policies=' || n || ' (expect 0)');

  reset role;
  select count(*) into n from public.reminders where user_id = u1 and sent_at is not null;
  r := array_append(r, 'reminders marked sent=' || n || ' (expect 1)');

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.notifications where user_id = u1;
  r := array_append(r, 'admin sees u1 notifications=' || n || ' (expect 0)');
  update public.notifications set read_at = null where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.notifications;
  r := array_append(r, 'outsider sees notifications=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.notifications;
    r := array_append(r, 'anon sees notifications=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
