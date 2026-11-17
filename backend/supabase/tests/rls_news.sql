-- Tests news privacy. Users: u1 owner, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261117000022. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; f1 uuid; f2 uuid; i1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'n-1@test.invalid'), (u2, 'n-2@test.invalid'), (u3, 'n-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.news_feeds (url) values ('https://example.com/other.xml') returning id into f2;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.news_feeds (url, title) values ('https://example.com/feed.xml', 'Example') returning id into f1;
  insert into public.news_items (feed_id, guid, title, link) values (f1, 'g1', 'Headline', 'https://example.com/a') returning id into i1;
  r := array_append(r, 'owner created feed and item OK');

  begin insert into public.news_feeds (user_id, url) values (u2, 'https://x.example/f');
    r := array_append(r, 'FAIL feed for another user');
  exception when others then r := array_append(r, 'feed spoofing blocked OK'); end;
  begin insert into public.news_items (feed_id, guid, title) values (f2, 'g', 'linked to another users feed');
    r := array_append(r, 'FAIL item linked to another user feed');
  exception when others then r := array_append(r, 'cross-user feed link blocked OK'); end;
  begin insert into public.news_feeds (url) values ('https://example.com/feed.xml');
    r := array_append(r, 'FAIL duplicate feed accepted');
  exception when others then r := array_append(r, 'duplicate feed blocked OK'); end;
  begin insert into public.news_items (feed_id, guid, title) values (f1, 'g1', 'same guid again');
    r := array_append(r, 'FAIL duplicate guid accepted');
  exception when others then r := array_append(r, 'duplicate guid blocked OK'); end;
  begin insert into public.news_feeds (url) values ('javascript:alert(1)');
    r := array_append(r, 'FAIL non-http feed url accepted');
  exception when others then r := array_append(r, 'non-http feed url blocked OK'); end;
  begin insert into public.news_items (feed_id, guid, title, link) values (f1, 'g2', 'x', 'javascript:alert(1)');
    r := array_append(r, 'FAIL non-http item link accepted');
  exception when others then r := array_append(r, 'non-http item link blocked OK'); end;

  update public.news_items set read_at = now(), saved = true where id = i1;
  select revision into rev from public.news_items where id = i1;
  r := array_append(r, 'item revision after update=' || rev || ' (expect 2)');
  update public.news_feeds set deleted_at = now() where id = f1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner feed soft delete rows=' || n || ' (expect 1)');
  insert into public.news_feeds (url) values ('https://example.com/feed.xml');
  r := array_append(r, 'same url reusable after soft delete OK');
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename in ('news_feeds','news_items') and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_feeds where user_id = u1;
  r := array_append(r, 'admin sees u1 feeds=' || n || ' (expect 0)');
  select count(*) into n from public.news_items where user_id = u1;
  r := array_append(r, 'admin sees u1 items=' || n || ' (expect 0)');
  update public.news_items set saved = false where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.news_items;
  r := array_append(r, 'outsider sees items=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.news_feeds;
    r := array_append(r, 'anon sees feeds=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
