-- Per-kind push preferences. user_settings.settings.push_kinds = ["date","reminder",...] lists the kinds that may be pushed.
-- Absent or not an array means every kind is pushed (the default). An empty array means none. The inbox is unaffected.
-- A notification of a muted kind is simply never marked pushed; it ages out of the dispatcher's one-day window.

create or replace function public.push_kind_enabled(p_settings jsonb, p_kind text)
returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_settings -> 'push_kinds') = 'array' then (p_settings -> 'push_kinds') ? p_kind
    else true
  end
$$;
revoke all on function public.push_kind_enabled(jsonb, text) from public, anon, authenticated;

create or replace function public.push_dispatch()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  secret text; target text; b record; resp record; items jsonb; ids uuid[]; rid bigint; batch uuid; n int := 0;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  select decrypted_secret into target from vault.decrypted_secrets where name = 'push_dispatch_url';
  if secret is null or target is null then return 0; end if;

  for b in select id, request_id, created_at from public.push_batches where collected_at is null loop
    select status_code, content into resp from net._http_response where id = b.request_id;
    if found then
      perform public.push_apply_results(b.id, resp.status_code, resp.content);
    elsif b.created_at < now() - interval '2 hours' then
      update public.push_batches set collected_at = now(), outcome = 'no response' where id = b.id;
    end if;
  end loop;

  -- unpushed notifications for users with a subscription, outside their quiet hours, for kinds they allow
  with pending as (
    select n.id, n.user_id, n.title, n.body, n.link
    from public.notifications n
    left join public.user_settings us on us.user_id = n.user_id
    where n.pushed_at is null and n.created_at > now() - interval '1 day'
      and exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id)
      and not public.push_in_quiet(us.settings, us.timezone, now())
      and public.push_kind_enabled(us.settings, n.kind)
    order by n.created_at
    limit 40
    for update of n skip locked
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
