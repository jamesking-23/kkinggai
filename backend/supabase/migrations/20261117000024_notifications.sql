-- Phase 16 (part 1): an in-app notification inbox filled by a scheduled database job. No keys or external services involved.
-- Users can read their notifications and mark them read (only the read_at column); they cannot create, edit or delete them.
-- Rows are created only by public.generate_notifications(), which runs as the database owner from pg_cron and is not callable
-- through the API. Each notification has a dedupe key so repeated runs never create duplicates.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('date','application','venture_task','puzzles','reminder')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 500),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_-]*$'),
  dedupe_key text not null check (char_length(dedupe_key) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_inbox_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.generate_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int := 0;
  c int;
begin
  drop table if exists pg_temp._u;
  create temporary table pg_temp._u on commit drop as
    select au.id as user_id,
           (now() at time zone case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name = s.timezone)
                                    then s.timezone else 'UTC' end)::date as today
    from auth.users au
    left join public.user_settings s on s.user_id = au.id;

  -- Important dates in the next 3 days (29 February is observed on 28 February in non-leap years).
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select d.user_id, 'date',
         d.title || case t.off when 0 then ' is today' when 1 then ' is tomorrow' else ' is in ' || t.off || ' days' end,
         d.kind, '/personal', 'date:' || d.id || ':' || (u.today + t.off)
  from public.important_dates d
  join pg_temp._u u on u.user_id = d.user_id
  cross join generate_series(0, 3) as t(off)
  where d.deleted_at is null
    and (
      (d.month = extract(month from u.today + t.off) and d.day = extract(day from u.today + t.off))
      or (d.month = 2 and d.day = 29 and extract(month from u.today + t.off) = 2 and extract(day from u.today + t.off) = 28
          and not ((extract(year from u.today + t.off)::int % 4 = 0 and extract(year from u.today + t.off)::int % 100 <> 0)
                   or extract(year from u.today + t.off)::int % 400 = 0))
    )
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- Job applications still on the wishlist whose deadline is within 3 days.
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select a.user_id, 'application', 'Deadline: ' || a.company || ' (' || a.role || ')',
         'Due ' || a.deadline, '/career', 'application:' || a.id || ':' || a.deadline
  from public.job_applications a
  join pg_temp._u u on u.user_id = a.user_id
  where a.deleted_at is null and a.status = 'wishlist'
    and a.deadline between u.today and u.today + 3
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- Venture tasks due tomorrow or earlier (up to 7 days overdue) and not done.
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select t.user_id, 'venture_task', 'Task due: ' || t.title, 'Due ' || t.due_on, '/business/' || t.venture_id,
         'vtask:' || t.id || ':' || t.due_on
  from public.venture_tasks t
  join pg_temp._u u on u.user_id = t.user_id
  where t.deleted_at is null and t.status <> 'done'
    and t.due_on between u.today - 7 and u.today + 1
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- Chess puzzles due for review: one notification per user per day.
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select p.user_id, 'puzzles', p.cnt || (case when p.cnt = 1 then ' puzzle is' else ' puzzles are' end) || ' due for review',
         '', '/chess/train', 'puzzles:' || u.today
  from (select user_id, count(*) as cnt from public.chess_puzzles
        where deleted_at is null and next_due_at <= now() group by user_id) p
  join pg_temp._u u on u.user_id = p.user_id
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- Reminders whose time has come: notify once and mark them sent.
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select r.user_id, 'reminder', left(r.message, 200), '', '/', 'reminder:' || r.id
  from public.reminders r
  where r.remind_at <= now() and r.sent_at is null and r.dismissed_at is null
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;
  update public.reminders set sent_at = now()
  where remind_at <= now() and sent_at is null and dismissed_at is null;

  return n;
end $$;

revoke all on function public.generate_notifications() from public, anon, authenticated;

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('notifications', 'Notifications', 'Inbox for deadlines, dates and reminders', '0.1.0', 'active', 'Notifications', '/notifications', 'bell', 5);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'notifications' from public.workspaces w
on conflict do nothing;
