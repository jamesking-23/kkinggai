-- Tests personal-life privacy. Users: u1 owner, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261117000021. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; j1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'p-1@test.invalid'), (u2, 'p-2@test.invalid'), (u3, 'p-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.journal_entries (entry_date, mood, body) values ('2026-11-17', 4, 'a good day') returning id into j1;
  insert into public.important_dates (title, kind, month, day, year) values ('Mum birthday', 'birthday', 3, 14, 1970);
  insert into public.important_dates (title, month, day) values ('Leap day', 2, 29);
  r := array_append(r, 'owner created entry and dates OK');

  begin insert into public.journal_entries (user_id, entry_date, body) values (u2, '2026-11-17', 'spoof');
    r := array_append(r, 'FAIL entry for another user');
  exception when others then r := array_append(r, 'entry spoofing blocked OK'); end;
  begin insert into public.journal_entries (entry_date, body) values ('2026-11-17', 'second entry same day');
    r := array_append(r, 'FAIL duplicate day accepted');
  exception when others then r := array_append(r, 'duplicate day blocked OK'); end;
  begin insert into public.journal_entries (entry_date, mood, body) values ('2026-11-18', 6, 'x');
    r := array_append(r, 'FAIL mood 6 accepted');
  exception when others then r := array_append(r, 'invalid mood blocked OK'); end;
  begin insert into public.journal_entries (entry_date, body) values ('2026-11-19', '');
    r := array_append(r, 'FAIL empty body accepted');
  exception when others then r := array_append(r, 'empty body blocked OK'); end;
  begin insert into public.important_dates (title, month, day) values ('x', 2, 30);
    r := array_append(r, 'FAIL 30 Feb accepted');
  exception when others then r := array_append(r, '30 Feb blocked OK'); end;
  begin insert into public.important_dates (title, month, day, year) values ('x', 2, 29, 2027);
    r := array_append(r, 'FAIL 29 Feb 2027 accepted');
  exception when others then r := array_append(r, '29 Feb in non-leap year blocked OK'); end;
  begin insert into public.important_dates (title, kind, month, day) values ('x', 'party', 1, 1);
    r := array_append(r, 'FAIL invalid kind accepted');
  exception when others then r := array_append(r, 'invalid kind blocked OK'); end;

  update public.journal_entries set body = 'edited' where id = j1;
  select revision into rev from public.journal_entries where id = j1;
  r := array_append(r, 'entry revision after update=' || rev || ' (expect 2)');
  update public.journal_entries set deleted_at = now() where id = j1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  insert into public.journal_entries (entry_date, body) values ('2026-11-17', 'rewritten after soft delete');
  r := array_append(r, 'same day reusable after soft delete OK');
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename in ('journal_entries','important_dates') and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.journal_entries where user_id = u1;
  r := array_append(r, 'admin sees u1 journal=' || n || ' (expect 0)');
  select count(*) into n from public.important_dates where user_id = u1;
  r := array_append(r, 'admin sees u1 dates=' || n || ' (expect 0)');
  update public.journal_entries set body = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.journal_entries;
  r := array_append(r, 'outsider sees journal=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.journal_entries;
    r := array_append(r, 'anon sees journal=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
