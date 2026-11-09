-- Tests academics and flashcards. Users: u1 owner, u2 member, u3 viewer, u4 outsider (own workspace ws4).
-- Requires migration 20261109000008. Rolls back via a final exception that carries the results.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid(); u4 uuid := gen_random_uuid();
  ws1 uuid; ws4 uuid; c1 uuid; c4 uuid; a1 uuid; d1 uuid; f1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'c-1@test.invalid'), (u2, 'c-2@test.invalid'), (u3, 'c-3@test.invalid'), (u4, 'c-4@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  select id into ws4 from public.workspaces where owner_id = u4;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'member'), (ws1, u3, 'viewer');
  -- an outsider course in ws4 (inserted as the table owner, bypassing RLS)
  insert into public.courses (workspace_id, name, created_by) values (ws4, 'Foreign course', u4) returning id into c4;

  -- ===== u2: member writes =====
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.courses (workspace_id, name, code) values (ws1, 'Structural Analysis', 'CE301') returning id into c1;
  insert into public.assignments (workspace_id, course_id, title, due_at) values (ws1, c1, 'Beam problem set', now() + interval '3 days') returning id into a1;
  insert into public.study_notes (workspace_id, course_id, title, body) values (ws1, c1, 'Moment diagrams', 'notes');
  insert into public.flashcard_decks (workspace_id, course_id, name) values (ws1, c1, 'Formulas') returning id into d1;
  insert into public.flashcards (workspace_id, deck_id, front, back) values (ws1, d1, 'M = ?', 'F x d') returning id into f1;
  r := array_append(r, 'member created course, assignment, note, deck, card OK');

  begin insert into public.assignments (workspace_id, course_id, title) values (ws1, c4, 'cross-workspace link');
    r := array_append(r, 'FAIL assignment linked to a course in another workspace');
  exception when others then r := array_append(r, 'cross-workspace course link blocked OK'); end;
  begin insert into public.courses (workspace_id, name, created_by) values (ws1, 'spoof', u1);
    r := array_append(r, 'FAIL created_by spoofing accepted');
  exception when others then r := array_append(r, 'created_by spoofing blocked OK'); end;
  begin insert into public.flashcards (workspace_id, deck_id, front, back, ease) values (ws1, d1, 'q', 'a', 9);
    r := array_append(r, 'FAIL out-of-range ease accepted');
  exception when others then r := array_append(r, 'out-of-range ease blocked OK'); end;
  begin insert into public.card_reviews (workspace_id, card_id, rating) values (ws1, f1, 7);
    r := array_append(r, 'FAIL rating 7 accepted');
  exception when others then r := array_append(r, 'invalid rating blocked OK'); end;

  insert into public.card_reviews (workspace_id, card_id, rating) values (ws1, f1, 2);
  update public.flashcards set interval_days = 1, repetitions = 1, due_at = now() + interval '1 day' where id = f1;
  select revision into rev from public.flashcards where id = f1;
  r := array_append(r, 'card revision after review=' || rev || ' (expect 2)');
  update public.assignments set deleted_at = now() where id = a1;
  get diagnostics n = row_count;
  r := array_append(r, 'member soft delete assignment rows=' || n || ' (expect 1)');
  delete from public.courses where id = c1;
  get diagnostics n = row_count;
  r := array_append(r, 'member hard delete course rows=' || n || ' (expect 0)');

  -- ===== u1 owner: sees shared data, not u2's review history =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.courses where workspace_id = ws1;
  r := array_append(r, 'owner sees shared courses=' || n || ' (expect 1)');
  select count(*) into n from public.card_reviews;
  r := array_append(r, 'owner sees member review history=' || n || ' (expect 0)');

  -- ===== u3 viewer: read only =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.flashcards where workspace_id = ws1;
  r := array_append(r, 'viewer reads cards=' || n || ' (expect 1)');
  begin insert into public.courses (workspace_id, name) values (ws1, 'viewer course');
    r := array_append(r, 'FAIL viewer created a course');
  exception when others then r := array_append(r, 'viewer insert blocked OK'); end;
  begin insert into public.card_reviews (workspace_id, card_id, rating) values (ws1, f1, 2);
    r := array_append(r, 'FAIL viewer logged a review');
  exception when others then r := array_append(r, 'viewer review insert blocked OK'); end;
  update public.flashcards set front = 'hacked' where id = f1;
  get diagnostics n = row_count;
  r := array_append(r, 'viewer update rows=' || n || ' (expect 0)');

  -- ===== u4 outsider and anon =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u4, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.courses where workspace_id = ws1;
  r := array_append(r, 'outsider sees ws1 courses=' || n || ' (expect 0)');
  select count(*) into n from public.assignments;
  r := array_append(r, 'outsider sees assignments=' || n || ' (expect 0)');
  select count(*) into n from public.flashcards;
  r := array_append(r, 'outsider sees flashcards=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.courses;
    r := array_append(r, 'anon sees courses=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
