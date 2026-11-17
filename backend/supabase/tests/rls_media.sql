-- Tests media log privacy. Users: u1 owner, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261117000023. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; m1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'm-1@test.invalid'), (u2, 'm-2@test.invalid'), (u3, 'm-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.media_items (kind, title, creator, status, rating) values ('book', 'Dune', 'Frank Herbert', 'done', 5) returning id into m1;
  r := array_append(r, 'owner created item OK');

  begin insert into public.media_items (user_id, kind, title) values (u2, 'book', 'spoof');
    r := array_append(r, 'FAIL item for another user');
  exception when others then r := array_append(r, 'item spoofing blocked OK'); end;
  begin insert into public.media_items (kind, title) values ('painting', 'x');
    r := array_append(r, 'FAIL invalid kind accepted');
  exception when others then r := array_append(r, 'invalid kind blocked OK'); end;
  begin insert into public.media_items (kind, title, status) values ('book', 'x', 'finished');
    r := array_append(r, 'FAIL invalid status accepted');
  exception when others then r := array_append(r, 'invalid status blocked OK'); end;
  begin insert into public.media_items (kind, title, rating) values ('book', 'x', 6);
    r := array_append(r, 'FAIL rating 6 accepted');
  exception when others then r := array_append(r, 'invalid rating blocked OK'); end;
  begin insert into public.media_items (kind, title, started_on, finished_on) values ('book', 'x', '2026-02-01', '2026-01-01');
    r := array_append(r, 'FAIL finish before start accepted');
  exception when others then r := array_append(r, 'finish-before-start blocked OK'); end;
  begin insert into public.media_items (kind, title) values ('book', '');
    r := array_append(r, 'FAIL empty title accepted');
  exception when others then r := array_append(r, 'empty title blocked OK'); end;

  update public.media_items set notes = 'great' where id = m1;
  select revision into rev from public.media_items where id = m1;
  r := array_append(r, 'revision after update=' || rev || ' (expect 2)');
  update public.media_items set deleted_at = now() where id = m1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'media_items' and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.media_items where user_id = u1;
  r := array_append(r, 'admin sees u1 items=' || n || ' (expect 0)');
  update public.media_items set title = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.media_items;
  r := array_append(r, 'outsider sees items=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.media_items;
    r := array_append(r, 'anon sees items=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
