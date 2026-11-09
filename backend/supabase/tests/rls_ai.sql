-- Tests AI conversation privacy. Users: u1 owner of data, u2 workspace admin in u1's workspace, u3 outsider.
-- Requires migration 20261108000006. Rolls back via a final exception that carries the results.
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  ws1 uuid; ws3 uuid; c1 uuid; n int; rev int; r text[] := '{}';
begin
  insert into auth.users (id, email) values
    (u1, 'a-1@test.invalid'), (u2, 'a-2@test.invalid'), (u3, 'a-3@test.invalid');
  select id into ws1 from public.workspaces where owner_id = u1;
  select id into ws3 from public.workspaces where owner_id = u3;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws1, u2, 'admin');

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.ai_conversations (workspace_id, title) values (ws1, 'hello') returning id into c1;
  insert into public.ai_messages (conversation_id, role, content) values (c1, 'user', 'hi');
  insert into public.ai_messages (conversation_id, role, content, provider, model, input_tokens, output_tokens)
    values (c1, 'assistant', 'hello', 'gemini', 'm', 3, 1);
  r := array_append(r, 'owner created conversation and messages OK');

  begin insert into public.ai_conversations (workspace_id, title) values (ws3, 'foreign workspace');
    r := array_append(r, 'FAIL created conversation in a workspace the user is not in');
  exception when others then r := array_append(r, 'conversation in foreign workspace blocked OK'); end;
  begin insert into public.ai_conversations (owner_id, workspace_id) values (u2, ws1);
    r := array_append(r, 'FAIL created conversation owned by another user');
  exception when others then r := array_append(r, 'owner spoofing on conversation blocked OK'); end;
  begin insert into public.ai_messages (conversation_id, role, content) values (c1, 'system', 'x');
    r := array_append(r, 'FAIL system role accepted');
  exception when others then r := array_append(r, 'system role blocked OK'); end;
  begin insert into public.ai_messages (conversation_id, role, content) values (c1, 'user', '');
    r := array_append(r, 'FAIL empty content accepted');
  exception when others then r := array_append(r, 'empty content blocked OK'); end;

  update public.ai_messages set content = 'edited' where conversation_id = c1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner edit message rows=' || n || ' (expect 0)');
  delete from public.ai_messages where conversation_id = c1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner delete message rows=' || n || ' (expect 0)');
  update public.ai_conversations set deleted_at = now() where id = c1;
  get diagnostics n = row_count;
  r := array_append(r, 'owner soft delete conversation rows=' || n || ' (expect 1)');
  select revision into rev from public.ai_conversations where id = c1;
  r := array_append(r, 'revision after update=' || rev || ' (expect 2)');
  update public.ai_conversations set deleted_at = null where id = c1;

  -- ===== u2: workspace admin, still must not see u1's chats =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.ai_conversations;
  r := array_append(r, 'admin sees conversations=' || n || ' (expect 0)');
  select count(*) into n from public.ai_messages;
  r := array_append(r, 'admin sees messages=' || n || ' (expect 0)');
  begin insert into public.ai_messages (conversation_id, role, content) values (c1, 'user', 'injected');
    r := array_append(r, 'FAIL wrote into another user conversation');
  exception when others then r := array_append(r, 'write into another user conversation blocked OK'); end;
  update public.ai_conversations set title = 'hacked' where id = c1;
  get diagnostics n = row_count;
  r := array_append(r, 'admin update rows=' || n || ' (expect 0)');

  -- ===== u3 outsider and anonymous =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.ai_conversations;
  r := array_append(r, 'outsider sees conversations=' || n || ' (expect 0)');

  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin select count(*) into n from public.ai_conversations;
    r := array_append(r, 'anon sees conversations=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon read blocked OK'); end;
  begin select count(*) into n from public.ai_messages;
    r := array_append(r, 'anon sees messages=' || n || ' (expect 0)');
  exception when others then r := array_append(r, 'anon message read blocked OK'); end;

  reset role;
  raise exception 'RESULTS: %', array_to_string(r, E'\n');
end $$;
