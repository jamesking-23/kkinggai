-- Tests the research library and its search. Users: u1 owner, u2 member, u3 viewer, u4 outsider (own workspace ws4).
-- Requires migration 20261109000011. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid(); u4 uuid := gen_random_uuid();
  ws1 uuid; ws4 uuid; c4 uuid; s1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'r-1@test.invalid'), (u2, 'r-2@test.invalid'), (u3, 'r-3@test.invalid'), (u4, 'r-4@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  select id into ws4 from public.workspaces where owner_id = u4;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'member'), (ws1, u3, 'viewer');
  insert into public.courses (workspace_id, name, created_by) values (ws4, 'Foreign course', u4) returning id into c4;

  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.research_sources (workspace_id, title, authors, published_year, summary, tags)
    values (ws1, 'Narwhal load paths', 'Okello, A.', 2021, 'about narwhal beams', array['structures']) returning id into s1;
  r := array_append(r, 'member created source OK');

  begin insert into public.research_sources (workspace_id, title, course_id) values (ws1, 'x', c4);
    r := array_append(r, 'FAIL linked to a course in another workspace');
  exception when others then r := array_append(r, 'cross-workspace course link blocked OK'); end;
  begin insert into public.research_sources (workspace_id, title, created_by) values (ws1, 'x', u1);
    r := array_append(r, 'FAIL created_by spoofing accepted');
  exception when others then r := array_append(r, 'created_by spoofing blocked OK'); end;
  begin insert into public.research_sources (workspace_id, title, published_year) values (ws1, 'x', 5);
    r := array_append(r, 'FAIL year 5 accepted');
  exception when others then r := array_append(r, 'implausible year blocked OK'); end;
  begin insert into public.research_sources (workspace_id, title, url) values (ws1, 'x', 'javascript:alert(1)');
    r := array_append(r, 'FAIL non-http url accepted');
  exception when others then r := array_append(r, 'non-http url blocked OK'); end;
  begin insert into public.research_sources (workspace_id, title, status) values (ws1, 'x', 'finished');
    r := array_append(r, 'FAIL invalid status accepted');
  exception when others then r := array_append(r, 'invalid status blocked OK'); end;

  update public.research_sources set status = 'read' where id = s1;
  select revision into rev from public.research_sources where id = s1;
  r := array_append(r, 'revision after update=' || rev || ' (expect 2)');
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'research_sources' and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies=' || n || ' (expect 0)');
  select count(*) into n from public.search_workspace(ws1, 'narwhal') where kind = 'research';
  r := array_append(r, 'member search finds source=' || n || ' (expect 1)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.research_sources where workspace_id = ws1;
  r := array_append(r, 'viewer reads sources=' || n || ' (expect 1)');
  begin insert into public.research_sources (workspace_id, title) values (ws1, 'viewer source');
    r := array_append(r, 'FAIL viewer created a source');
  exception when others then r := array_append(r, 'viewer insert blocked OK'); end;
  update public.research_sources set title = 'hacked' where id = s1;
  get diagnostics n = row_count;
  r := array_append(r, 'viewer update rows=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u4, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.research_sources;
  r := array_append(r, 'outsider sees sources=' || n || ' (expect 0)');
  select count(*) into n from public.search_workspace(ws1, 'narwhal');
  r := array_append(r, 'outsider search of ws1=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.research_sources;
    r := array_append(r, 'anon sees sources=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
