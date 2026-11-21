-- Web push delivery for notifications. The database never holds a push secret in code: the shared secret and the target URL
-- live in Supabase Vault (created by hand, see docs), so until they exist push_dispatch() does nothing.
-- Flow: pg_cron -> push_dispatch() -> pg_net POST to the site's /api/push/dispatch (bearer secret) -> the site encrypts and
-- sends with VAPID -> next run reads the response and prunes dead subscriptions. Delivery is at most once per notification.

create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22,43}$'),
  user_agent text check (char_length(user_agent) <= 300),
  failure_count int not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

alter table public.notifications add column pushed_at timestamptz;
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

create table public.push_batches (
  id uuid primary key default gen_random_uuid(),
  request_id bigint not null,
  item_count int not null,
  outcome text,
  created_at timestamptz not null default now(),
  collected_at timestamptz
);
alter table public.push_batches enable row level security;
revoke all on public.push_batches from anon, authenticated;

-- Saves this browser's subscription for the signed-in user. A browser that was subscribed under another account is taken over.
create function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); sid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, failure_count = 0
  returning id into sid;
  -- at most 5 devices per user: drop the oldest beyond that
  delete from public.push_subscriptions
  where id in (select id from public.push_subscriptions where user_id = uid order by created_at desc offset 5);
  return sid;
end $$;
revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- Applies the site's answer for a batch: delivered -> reset failures; gone (404/410) -> delete; other errors count, five in a row delete.
create function public.push_apply_results(p_batch uuid, p_status int, p_content text)
returns void
language plpgsql security definer set search_path = '' as $$
declare j jsonb; r jsonb; s int; sid uuid;
begin
  if p_status = 200 then
    begin j := p_content::jsonb; exception when others then j := null; end;
    if j is not null and jsonb_typeof(j -> 'results') = 'array' then
      for r in select * from jsonb_array_elements(j -> 'results') loop
        begin
          sid := (r ->> 'sub')::uuid; s := (r ->> 'status')::int;
        exception when others then continue; end;
        if s between 200 and 299 then
          update public.push_subscriptions set last_success_at = now(), failure_count = 0 where id = sid;
        elsif s in (404, 410) then
          delete from public.push_subscriptions where id = sid;
        else
          update public.push_subscriptions set failure_count = failure_count + 1 where id = sid;
          delete from public.push_subscriptions where id = sid and failure_count >= 5;
        end if;
      end loop;
    end if;
  end if;
  update public.push_batches
  set collected_at = now(), outcome = case when p_status = 200 then 'ok' else 'http ' || coalesce(p_status::text, 'none') end
  where id = p_batch;
end $$;
revoke all on function public.push_apply_results(uuid, int, text) from public, anon, authenticated;

create function public.push_dispatch()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  secret text; target text; b record; resp record; items jsonb; ids uuid[]; rid bigint; batch uuid; n int := 0;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  select decrypted_secret into target from vault.decrypted_secrets where name = 'push_dispatch_url';
  if secret is null or target is null then return 0; end if;

  -- 1. read answers for earlier batches (pg_net keeps responses for a few hours)
  for b in select id, request_id, created_at from public.push_batches where collected_at is null loop
    select status_code, content into resp from net._http_response where id = b.request_id;
    if found then
      perform public.push_apply_results(b.id, resp.status_code, resp.content);
    elsif b.created_at < now() - interval '2 hours' then
      update public.push_batches set collected_at = now(), outcome = 'no response' where id = b.id;
    end if;
  end loop;

  -- 2. send recent unpushed notifications for users that have a subscription
  with pending as (
    select n.id, n.user_id, n.title, n.body, n.link
    from public.notifications n
    where n.pushed_at is null and n.created_at > now() - interval '1 day'
      and exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id)
    order by n.created_at
    limit 40
    for update skip locked
  ), marked as (
    update public.notifications u set pushed_at = now() from pending p where u.id = p.id returning p.*
  )
  select jsonb_agg(jsonb_build_object(
           'sub', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'payload', jsonb_build_object('title', m.title, 'body', left(m.body, 200), 'url', coalesce(m.link, '/notifications'), 'tag', m.id))),
         array_agg(distinct m.id)
    into items, ids
  from marked m join public.push_subscriptions s on s.user_id = m.user_id;

  if items is null then return 0; end if;
  n := jsonb_array_length(items);
  select net.http_post(
           url := target,
           body := jsonb_build_object('items', items),
           headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
           timeout_milliseconds := 20000) into rid;
  insert into public.push_batches (request_id, item_count) values (rid, n);
  return n;
end $$;
revoke all on function public.push_dispatch() from public, anon, authenticated;

select cron.schedule('push-dispatch', '*/5 * * * *', 'select public.push_dispatch()');
