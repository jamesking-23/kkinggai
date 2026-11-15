-- Phase 11 (running, part 3): Strava connection. One row per user holding the OAuth tokens Strava issued to this app.
-- Owner-only RLS. NOTE: tokens are readable by the owner's own session (there is no server-only secret store in this setup);
-- they grant read access to that user's own Strava activities only, and can be revoked at strava.com/settings/apps.
-- Disconnecting deletes the row, so this is the one table here with an owner DELETE policy.

create table public.strava_connections (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  athlete_id bigint not null,
  access_token text not null check (char_length(access_token) between 10 and 200),
  refresh_token text not null check (char_length(refresh_token) between 10 and 200),
  expires_at timestamptz not null,
  scope text not null default '' check (char_length(scope) <= 200),
  last_synced_at timestamptz,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger strava_connections_rev before update on public.strava_connections for each row execute function public.bump_revision();

alter table public.strava_connections enable row level security;
create policy strava_connections_select on public.strava_connections for select to authenticated using (user_id = (select auth.uid()));
create policy strava_connections_insert on public.strava_connections for insert to authenticated with check (user_id = (select auth.uid()));
create policy strava_connections_update on public.strava_connections for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy strava_connections_delete on public.strava_connections for delete to authenticated using (user_id = (select auth.uid()));
