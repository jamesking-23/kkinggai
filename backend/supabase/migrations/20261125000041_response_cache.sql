-- Shared semantic cache for the assistant's Tier 2 (answers to general, non-personal questions).
-- Written and read ONLY by the server with the service-role key. Signed-in users and anonymous visitors have no access
-- at all (RLS on, no policies, privileges revoked), so nobody can read other people's questions or plant answers.
create extension if not exists vector with schema extensions;

create table public.response_cache (
  id uuid primary key default gen_random_uuid(),
  query_text text not null check (char_length(query_text) between 1 and 500),
  embedding extensions.vector(384) not null,
  -- Which embedding model produced the vector; vectors from different models are never compared.
  embedder text not null,
  response_text text not null check (char_length(response_text) between 1 and 8000),
  -- Facts the answer was built from, as "factId@version". Changing a fact invalidates its answers.
  source_fact_ids text[] not null default '{}',
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table public.response_cache enable row level security;
revoke all on public.response_cache from anon, authenticated;

create index response_cache_embedding_idx
  on public.response_cache using hnsw (embedding extensions.vector_cosine_ops);
create index response_cache_last_used_idx on public.response_cache (last_used_at);
create index response_cache_facts_idx on public.response_cache using gin (source_fact_ids);

-- Best matches above a similarity floor, same embedder only.
create function public.match_response_cache(
  q extensions.vector(384), p_embedder text, min_sim double precision, n integer default 3
)
returns table (id uuid, query_text text, response_text text, source_fact_ids text[], similarity double precision)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.query_text, c.response_text, c.source_fact_ids,
         1 - (c.embedding <=> q) as similarity
  from public.response_cache c
  where c.embedder = p_embedder and 1 - (c.embedding <=> q) >= min_sim
  order by c.embedding <=> q
  limit greatest(1, least(n, 10));
$$;

create function public.touch_response_cache(p_id uuid)
returns void language sql
set search_path = public
as $$ update public.response_cache set last_used_at = now(), hits = hits + 1 where id = p_id; $$;

-- Keeps the cache at most max_rows entries by dropping the least recently used.
create function public.prune_response_cache(max_rows integer default 10000)
returns integer language plpgsql
set search_path = public
as $$
declare removed integer;
begin
  with doomed as (
    select id from public.response_cache
    order by last_used_at desc, created_at desc
    offset greatest(max_rows, 0)
  )
  delete from public.response_cache c using doomed d where c.id = d.id;
  get diagnostics removed = row_count;
  return removed;
end $$;

-- Removes every cached answer built from a fact (any version of it).
create function public.invalidate_response_cache(p_fact text)
returns integer language plpgsql
set search_path = public
as $$
declare removed integer;
begin
  delete from public.response_cache c
  where exists (
    select 1 from unnest(c.source_fact_ids) f where f = p_fact or f like p_fact || '@%'
  );
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function public.match_response_cache(extensions.vector, text, double precision, integer) from public, anon, authenticated;
revoke all on function public.touch_response_cache(uuid) from public, anon, authenticated;
revoke all on function public.prune_response_cache(integer) from public, anon, authenticated;
revoke all on function public.invalidate_response_cache(text) from public, anon, authenticated;
grant execute on function public.match_response_cache(extensions.vector, text, double precision, integer) to service_role;
grant execute on function public.touch_response_cache(uuid) to service_role;
grant execute on function public.prune_response_cache(integer) to service_role;
grant execute on function public.invalidate_response_cache(text) to service_role;
grant all on public.response_cache to service_role;
