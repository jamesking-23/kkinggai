-- Tests career privacy. Users: u1 owner of data, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261109000009. Rolls back via a final exception that carries the results. Non-destructive.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; app1 uuid; app2 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'k-1@test.invalid'), (u2, 'k-2@test.invalid'), (u3, 'k-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  -- u2 owns an application of their own, used for the cross-user link check
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.job_applications (company, role) values ('Other Co', 'Analyst') returning id into app2;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.career_profiles (headline, summary) values ('Civil engineer', 'x');
  insert into public.cv_entries (kind, title, start_date, end_date) values ('experience', 'Site engineer', '2024-01-01', '2024-06-30');
  insert into public.job_applications (company, role, status) values ('Acme', 'Graduate engineer', 'applied') returning id into app1;
  insert into public.interview_prep (application_id, question) values (app1, 'Tell me about yourself');
  insert into public.portfolio_items (title, url, tags) values ('Bridge design', 'https://example.com', array['civil']);
  r := array_append(r, 'owner created profile, entry, application, prep, portfolio OK');

  begin insert into public.career_profiles (user_id, headline) values (u2, 'spoof');
    r := array_append(r, 'FAIL inserted profile for another user');
  exception when others then r := array_append(r, 'profile spoofing blocked OK'); end;
  begin insert into public.job_applications (user_id, company, role) values (u2, 'x', 'y');
    r := array_append(r, 'FAIL inserted application for another user');
  exception when others then r := array_append(r, 'application spoofing blocked OK'); end;
  begin insert into public.interview_prep (application_id, question) values (app2, 'linked to another users application');
    r := array_append(r, 'FAIL prep linked to another user application');
  exception when others then r := array_append(r, 'cross-user application link blocked OK'); end;
  begin insert into public.cv_entries (kind, title, start_date, end_date) values ('experience', 'bad dates', '2024-06-01', '2024-01-01');
    r := array_append(r, 'FAIL end before start accepted');
  exception when others then r := array_append(r, 'end-before-start blocked OK'); end;
  begin insert into public.job_applications (company, role, status) values ('x', 'y', 'hired');
    r := array_append(r, 'FAIL invalid status accepted');
  exception when others then r := array_append(r, 'invalid status blocked OK'); end;
  begin insert into public.portfolio_items (title, url) values ('x', 'javascript:alert(1)');
    r := array_append(r, 'FAIL non-http url accepted');
  exception when others then r := array_append(r, 'non-http url blocked OK'); end;

  update public.job_applications set status = 'interviewing' where id = app1;
  select revision into rev from public.job_applications where id = app1;
  r := array_append(r, 'application revision after update=' || rev || ' (expect 2)');
  update public.job_applications set deleted_at = now() where id = app1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  select count(*) into n from pg_policies
    where schemaname = 'public' and tablename in ('career_profiles','cv_entries','job_applications','interview_prep','portfolio_items')
      and cmd in ('DELETE','ALL');
  r := array_append(r, 'DELETE policies on career tables=' || n || ' (expect 0)');

  -- ===== u2: workspace admin must not see u1's career data =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.career_profiles where user_id = u1;
  r := array_append(r, 'admin sees u1 profile=' || n || ' (expect 0)');
  select count(*) into n from public.cv_entries where user_id = u1;
  r := array_append(r, 'admin sees u1 cv entries=' || n || ' (expect 0)');
  select count(*) into n from public.job_applications where user_id = u1;
  r := array_append(r, 'admin sees u1 applications=' || n || ' (expect 0)');
  select count(*) into n from public.interview_prep where user_id = u1;
  r := array_append(r, 'admin sees u1 prep=' || n || ' (expect 0)');
  select count(*) into n from public.portfolio_items where user_id = u1;
  r := array_append(r, 'admin sees u1 portfolio=' || n || ' (expect 0)');
  update public.job_applications set company = 'hacked' where user_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  -- ===== u3 outsider and anonymous =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.job_applications;
  r := array_append(r, 'outsider sees applications=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.career_profiles;
    r := array_append(r, 'anon sees profiles=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
