-- Tests search over academics, flashcards and career. Users: u1 owner with data, u2 admin in u1's workspace, u3 outsider.
-- Requires migrations 9 and 10. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; c1 uuid; d1 uuid; n int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'x-1@test.invalid'), (u2, 'x-2@test.invalid'), (u3, 'x-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.courses (workspace_id, name, code) values (ws1, 'Zebra mechanics', 'ZB1') returning id into c1;
  insert into public.study_notes (workspace_id, course_id, title, body) values (ws1, c1, 'Zebra notes', 'x');
  insert into public.flashcard_decks (workspace_id, name) values (ws1, 'Zebra deck') returning id into d1;
  insert into public.flashcards (workspace_id, deck_id, front, back) values (ws1, d1, 'Zebra front', 'back');
  insert into public.job_applications (company, role) values ('Zebra Corp', 'Engineer');
  insert into public.interview_prep (question) values ('Why Zebra?');
  insert into public.portfolio_items (title) values ('Zebra project');

  select count(*) into n from public.search_workspace(ws1, 'zebra');
  r := array_append(r, 'owner finds zebra=' || n || ' (expect 7)');
  select count(*) into n from public.search_workspace(ws1, 'zebra') where kind in ('application','interview','portfolio');
  r := array_append(r, 'owner career hits=' || n || ' (expect 3)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'zebra');
  r := array_append(r, 'admin finds zebra=' || n || ' (expect 4: course, note, deck, card)');
  select count(*) into n from public.search_workspace(ws1, 'zebra') where kind in ('application','interview','portfolio');
  r := array_append(r, 'admin career hits=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'zebra');
  r := array_append(r, 'outsider finds zebra=' || n || ' (expect 0)');

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
