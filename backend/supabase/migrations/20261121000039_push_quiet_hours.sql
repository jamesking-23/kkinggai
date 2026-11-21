-- Push quiet hours. A user can hold back push between two local times; the notification still appears in the inbox,
-- and is pushed after the quiet window ends if it is still less than a day old (the dispatcher's existing window).
-- Stored in user_settings.settings.push_quiet = {"from":"22:00","to":"07:00"}, evaluated in user_settings.timezone.
-- from = to means no quiet hours. A bad or missing block or an unknown timezone means "not quiet" (push is never lost by a typo).

create or replace function public.push_in_quiet(p_settings jsonb, p_tz text, p_at timestamptz)
returns boolean
language plpgsql stable set search_path = '' as $$
declare
  q jsonb; f time; t time; local_t time;
begin
  q := p_settings -> 'push_quiet';
  if q is null or jsonb_typeof(q) <> 'object' then return false; end if;
  if (q ->> 'from') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (q ->> 'to') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    return false;
  end if;
  f := (q ->> 'from')::time; t := (q ->> 'to')::time;
  if f = t then return false; end if;
  local_t := (p_at at time zone coalesce(p_tz, 'UTC'))::time;
  if f < t then return local_t >= f and local_t < t; end if;
  return local_t >= f or local_t < t; -- window crosses midnight
exception when others then
  return false;
end $$;
revoke all on function public.push_in_quiet(jsonb, text, timestamptz) from public, anon, authenticated;

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

  -- unpushed notifications for users with a subscription who are not in their quiet hours right now
  with pending as (
    select n.id, n.user_id, n.title, n.body, n.link
    from public.notifications n
    left join public.user_settings us on us.user_id = n.user_id
    where n.pushed_at is null and n.created_at > now() - interval '1 day'
      and exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id)
      and not public.push_in_quiet(us.settings, us.timezone, now())
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
