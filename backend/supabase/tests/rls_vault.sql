-- Tests Vault privacy. Users: u1 owner of data, u2 another user (also in u1's workspace as admin), u3 outsider.
-- Rolls back via a final exception that carries the results.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; note1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'v-1@test.invalid'), (u2, 'v-2@test.invalid'), (u3, 'v-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  -- ===== u1: owner of vault data =====
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.vault_items (kind, title, body) values ('note', 'secret note', 'x') returning id into note1;
  r := array_append(r, 'owner created note OK');
  insert into public.vault_items (kind, title, url) values ('link', 'a link', 'https://example.com');
  insert into public.vault_items (kind, title, storage_path) values ('file', 'doc', u1::text || '/a.pdf');
  r := array_append(r, 'owner created link and own-folder file OK');

  begin insert into public.vault_items (kind, title, storage_path) values ('file', 'bad', u2::text || '/a.pdf');
    r := array_append(r, 'FAIL file pointed at another user folder');
  exception when others then r := array_append(r, 'file path in another folder blocked OK'); end;
  begin insert into public.vault_items (kind, title, url) values ('link', 'bad', 'javascript:alert(1)');
    r := array_append(r, 'FAIL non-http url accepted');
  exception when others then r := array_append(r, 'non-http url blocked OK'); end;
  begin insert into public.vault_items (kind, title) values ('link', 'no url');
    r := array_append(r, 'FAIL link without url accepted');
  exception when others then r := array_append(r, 'link without url blocked OK'); end;
  begin insert into public.vault_items (owner_id, kind, title) values (u2, 'note', 'spoofed owner');
    r := array_append(r, 'FAIL inserted row owned by another user');
  exception when others then r := array_append(r, 'owner spoofing on insert blocked OK'); end;

  update public.vault_items set title = 'renamed' where id = note1;
  select revision into rev from public.vault_items where id = note1;
  r := array_append(r, 'revision after update=' || rev || ' (expect 2)');
  update public.vault_items set deleted_at = now() where id = note1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete rows=' || n || ' (expect 1)');
  delete from public.vault_items where id = note1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner hard delete rows=' || n || ' (expect 0)');

  -- storage objects: own folder allowed
  insert into storage.objects (bucket_id, name, owner_id) values ('vault', u1::text || '/a.pdf', u1::text);
  r := array_append(r, 'owner uploaded to own folder OK');
  begin insert into storage.objects (bucket_id, name, owner_id) values ('vault', u2::text || '/evil.pdf', u1::text);
    r := array_append(r, 'FAIL uploaded into another user folder');
  exception when others then r := array_append(r, 'upload into another folder blocked OK'); end;

  -- ===== u2: another user, even a workspace admin of u1's workspace =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.vault_items;
  r := array_append(r, 'other user sees vault items=' || n || ' (expect 0)');
  update public.vault_items set title = 'hacked' where owner_id = u1;
  get diagnostics n = row_count;
  r := array_append(r, 'other user update rows=' || n || ' (expect 0)');
  select count(*) into n from storage.objects where bucket_id = 'vault';
  r := array_append(r, 'other user sees vault objects=' || n || ' (expect 0)');
  -- (direct deletes from storage.objects are blocked by Supabase's own trigger; deletion goes through the Storage API)

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.vault_items;
  r := array_append(r, 'outsider sees vault items=' || n || ' (expect 0)');

  -- ===== anonymous =====
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.vault_items;
    r := array_append(r, 'anon sees vault items=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;
  begin select count(*) into n from storage.objects where bucket_id = 'vault';
    r := array_append(r, 'anon sees vault objects=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon storage read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
