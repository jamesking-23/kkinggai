-- search_workspace attachment hits (migration 037). Rollback-only. Live result (2026-11-21): 8 lines, all as expected.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; t1 uuid; t2 uuid; a1 uuid; n int; r text[] := '{}'; rec record;
begin
  insert into auth.users (id, email) values (u1,'sa-1@test.invalid'),(u2,'sa-2@test.invalid'),(u3,'sa-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u3, 'viewer');
  insert into public.tasks (workspace_id, title, created_by) values (ws1,'Quarterly report',u1) returning id into t1;
  insert into public.tasks (workspace_id, title, created_by) values (ws1,'Other',u1) returning id into t2;
  insert into public.task_attachments (workspace_id, task_id, storage_path, file_name, mime_type, size_bytes, created_by)
    values (ws1, t1, ws1::text||'/'||t1::text||'/a.pdf', 'budget-2026.pdf', 'application/pdf', 10, u1) returning id into a1;
  insert into public.task_attachments (workspace_id, task_id, storage_path, file_name, mime_type, size_bytes, created_by)
    values (ws1, t2, ws1::text||'/'||t2::text||'/b.pdf', 'budget-old.pdf', 'application/pdf', 10, u1);

  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'budget', 8) where kind = 'attachment';
  r := array_append(r,'owner finds attachments=' || n || ' (expect 2)');
  select * into rec from public.search_workspace(ws1, 'budget-2026', 8) where kind = 'attachment';
  r := array_append(r,'hit title=' || rec.title || ' snippet=' || rec.snippet || ' href ok=' || (rec.href = '/tasks/' || t1) || ' (expect budget-2026.pdf, Quarterly report, true)');
  select count(*) into n from public.search_workspace(ws1, 'bud%', 8) where kind = 'attachment';
  r := array_append(r,'wildcard is literal, hits=' || n || ' (expect 0)');
  update public.task_attachments set deleted_at = now() where id = a1;
  select count(*) into n from public.search_workspace(ws1, 'budget-2026', 8) where kind = 'attachment';
  r := array_append(r,'soft-deleted attachment hidden=' || n || ' (expect 0)');
  update public.tasks set deleted_at = now() where id = t2;
  select count(*) into n from public.search_workspace(ws1, 'budget-old', 8) where kind = 'attachment';
  r := array_append(r,'attachment of deleted task hidden=' || n || ' (expect 0)');
  update public.task_attachments set deleted_at = null where id = a1;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u3,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'budget-2026', 8) where kind = 'attachment';
  r := array_append(r,'viewer finds=' || n || ' (expect 1)');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.search_workspace(ws1, 'budget-2026', 8);
  r := array_append(r,'outsider finds=' || n || ' (expect 0)');
  reset role;
  set local role anon;
  begin perform * from public.search_workspace(ws1, 'budget', 8); r := array_append(r,'FAIL anon searched');
  exception when others then r := array_append(r,'anon refused OK'); end;
  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
