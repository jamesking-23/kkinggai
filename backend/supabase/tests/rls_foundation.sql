-- RLS test for the foundation schema. Creates two users, exercises access boundaries, then raises an
-- exception carrying the results so everything rolls back. Run via the Supabase SQL editor / MCP.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  ws1 uuid; ws2 uuid; n int; r text[] := '{}';
begin
  insert into auth.users (id, email) values (u1, 'rls-a@test.invalid'), (u2, 'rls-b@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  select id into ws2 from public.workspaces where owner_id = u2;
  r := r || ('signup provisioning: ws1/ws2 created=' || (ws1 is not null and ws2 is not null)::text);
  select count(*) into n from public.workspace_modules where workspace_id = ws1;
  r := r || ('default modules enabled for new ws=' || n);

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.workspaces; r := r || ('u1 sees workspaces=' || n || ' (expect 1)');
  select count(*) into n from public.profiles; r := r || ('u1 sees profiles=' || n || ' (expect 1)');
  select count(*) into n from public.workspace_members where workspace_id = ws2; r := r || ('u1 sees ws2 members=' || n || ' (expect 0)');
  select count(*) into n from public.workspace_modules where workspace_id = ws2; r := r || ('u1 sees ws2 modules=' || n || ' (expect 0)');
  select count(*) into n from public.module_registry; r := r || ('u1 reads registry rows=' || n || ' (expect 2)');

  update public.workspaces set name = 'hacked' where id = ws2; get diagnostics n = row_count;
  r := r || ('u1 update ws2 rows=' || n || ' (expect 0)');
  update public.workspaces set name = 'mine' where id = ws1; get diagnostics n = row_count;
  r := r || ('u1 update own ws rows=' || n || ' (expect 1)');

  begin insert into public.workspace_members (workspace_id, user_id, role) values (ws2, u1, 'member');
    r := array_append(r, 'FAIL u1 joined ws2');
  exception when others then r := array_append(r, 'u1 join ws2 blocked OK'); end;
  begin insert into public.audit_logs (workspace_id, actor_id, action) values (ws2, u1, 'x');
    r := array_append(r, 'FAIL audit write to ws2');
  exception when others then r := array_append(r, 'u1 audit write to ws2 blocked OK'); end;
  begin insert into public.workspaces (name, owner_id) values ('steal', u2);
    r := array_append(r, 'FAIL created ws owned by u2');
  exception when others then r := array_append(r, 'u1 create ws for u2 blocked OK'); end;
  begin insert into public.module_registry (id, name, version) values ('evil', 'x', '1.0.0');
    r := array_append(r, 'FAIL wrote registry');
  exception when others then r := array_append(r, 'u1 registry write blocked OK'); end;
  begin update public.workspace_members set role = 'owner' where workspace_id = ws1 and user_id = u1;
    get diagnostics n = row_count; r := r || ('u1 self-promote rows=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'u1 self-promote blocked OK'); end;
  begin delete from public.audit_logs; get diagnostics n = row_count; r := r || ('audit delete rows=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'audit delete blocked OK'); end;

  reset role;
  set local role anon;
  begin select count(*) into n from public.workspaces; r := r || ('anon sees workspaces=' || n || ' (expect error or 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;
  reset role;

  raise exception E'RLS_TEST_RESULTS\n%', array_to_string(r, E'\n');
end $$;
