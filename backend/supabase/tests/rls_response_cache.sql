-- Run as a superuser. Signed-in users and anon must not be able to touch the cache or call its functions.
begin;
insert into public.response_cache (query_text, embedding, embedder, response_text, source_fact_ids)
values ('test q', (select array_agg(0.01)::extensions.vector from generate_series(1,384)), 't', 'a', '{f1@1}');

set local role authenticated;
do $$ begin
  begin perform 1 from public.response_cache; raise exception 'authenticated could read response_cache';
  exception when insufficient_privilege then null; end;
  begin perform public.invalidate_response_cache('f1'); raise exception 'authenticated could call invalidate';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.response_cache; raise exception 'anon could read response_cache';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  if public.invalidate_response_cache('f1') <> 1 then raise exception 'invalidate did not remove the row'; end if;
end $$;
rollback;
