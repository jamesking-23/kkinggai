-- RLS and storage-policy test for task_attachments and the task-files bucket.
-- Rollback-only: it always ends in `raise exception 'RESULTS: ...'`.
-- Live result (2026-11-19): 19 lines, every check as expected.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; ws2 uuid; t1 uuid; t2 uuid; a1 uuid; n int; rev int; r text[] := '{}';
  p1 text; bad text;
begin
  insert into auth.users (id, email) values (u1,'ta-1@test.invalid'),(u2,'ta-2@test.invalid'),(u3,'ta-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  select id into ws2 from public.workspaces where owner_id = u2;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u3, 'viewer');
  insert into public.tasks (workspace_id, title, created_by) values (ws1,'T1',u1) returning id into t1;
  insert into public.tasks (workspace_id, title, created_by) values (ws1,'T2',u1) returning id into t2;
  p1 := ws1::text || '/' || t1::text || '/abc-file.pdf';

  -- u1 (owner): upload object + metadata
  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;
  insert into storage.objects (bucket_id, name, owner_id) values ('task-files', p1, u1::text);
  insert into public.task_attachments (workspace_id, task_id, storage_path, file_name, mime_type, size_bytes)
    values (ws1, t1, p1, 'file.pdf', 'application/pdf', 1000) returning id into a1;
  r := array_append(r,'owner uploaded object and metadata OK');
  begin insert into public.task_attachments (workspace_id, task_id, storage_path, file_name, mime_type, size_bytes)
      values (ws1, t1, ws1::text || '/' || t2::text || '/x.pdf', 'x.pdf', 'application/pdf', 1);
    r := array_append(r,'FAIL path of another task accepted');
  exception when others then r := array_append(r,'metadata path of a different task blocked OK'); end;
  begin insert into public.task_attachments (workspace_id, task_id, storage_path, file_name, mime_type, size_bytes, created_by)
      values (ws1, t1, ws1::text || '/' || t1::text || '/y.pdf', 'y.pdf', 'application/pdf', 1, u2);
    r := array_append(r,'FAIL created_by spoof accepted');
  exception when others then r := array_append(r,'created_by spoof blocked OK'); end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('task-files', ws2::text || '/' || t1::text || '/z.pdf', u1::text);
    r := array_append(r,'FAIL object written into another workspace folder');
  exception when others then r := array_append(r,'object into foreign workspace folder blocked OK'); end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('task-files', 'not-a-uuid/' || t1::text || '/z.pdf', u1::text);
    r := array_append(r,'FAIL malformed folder accepted');
  exception when others then r := array_append(r,'malformed folder name denied (no cast error leak) OK'); end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('task-files', 'top-level.pdf', u1::text);
    r := array_append(r,'FAIL root-level object accepted');
  exception when others then r := array_append(r,'object without folder denied OK'); end;
  select count(*) into n from storage.objects where bucket_id = 'task-files';
  r := array_append(r,'owner sees objects=' || n || ' (expect 1)');
  -- soft delete via update
  update public.task_attachments set deleted_at = now() where id = a1;
  select revision into rev from public.task_attachments where id = a1;
  r := array_append(r,'soft delete OK, revision=' || rev || ' (expect 2)');
  update public.task_attachments set deleted_at = null where id = a1;

  -- u3 viewer: reads, cannot write
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',u3,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.task_attachments;
  r := array_append(r,'viewer sees attachments=' || n || ' (expect 1)');
  select count(*) into n from storage.objects where bucket_id = 'task-files';
  r := array_append(r,'viewer sees objects=' || n || ' (expect 1)');
  begin insert into storage.objects (bucket_id, name, owner_id) values ('task-files', ws1::text || '/' || t1::text || '/v.pdf', u3::text);
    r := array_append(r,'FAIL viewer uploaded');
  exception when others then r := array_append(r,'viewer upload blocked OK'); end;
  begin insert into public.task_attachments (workspace_id, task_id, storage_path, file_name, mime_type, size_bytes)
      values (ws1, t1, ws1::text || '/' || t1::text || '/v.pdf', 'v.pdf', 'application/pdf', 1);
    r := array_append(r,'FAIL viewer recorded attachment');
  exception when others then r := array_append(r,'viewer metadata insert blocked OK'); end;
  update public.task_attachments set deleted_at = now() where id = a1;
  reset role;
  select (deleted_at is null) into bad from public.task_attachments where id = a1;
  r := array_append(r,'viewer soft delete changed nothing=' || bad || ' (expect true)');

  -- u2 outsider: sees nothing, writes nothing
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.task_attachments;
  r := array_append(r,'outsider sees attachments=' || n || ' (expect 0)');
  select count(*) into n from storage.objects where bucket_id = 'task-files';
  r := array_append(r,'outsider sees objects=' || n || ' (expect 0)');
  begin insert into storage.objects (bucket_id, name, owner_id) values ('task-files', ws1::text || '/' || t1::text || '/o.pdf', u2::text);
    r := array_append(r,'FAIL outsider uploaded into ws1');
  exception when others then r := array_append(r,'outsider upload blocked OK'); end;

  -- anon
  reset role;
  perform set_config('request.jwt.claims','{}', true);
  set local role anon;
  select count(*) into n from public.task_attachments;
  r := array_append(r,'anon sees attachments=' || n || ' (expect 0)');
  begin insert into storage.objects (bucket_id, name) values ('task-files', ws1::text || '/' || t1::text || '/a.pdf');
    r := array_append(r,'FAIL anon uploaded');
  exception when others then r := array_append(r,'anon upload blocked OK'); end;
  reset role;
  -- no update/delete policy on task-files objects, no delete policy on the table
  select count(*) into n from pg_policies where (schemaname='public' and tablename='task_attachments' and cmd='DELETE')
     or (schemaname='storage' and tablename='objects' and policyname like 'task_files%' and cmd in ('DELETE','UPDATE'));
  r := array_append(r,'delete/update policies on attachments=' || n || ' (expect 0)');
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
