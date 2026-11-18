-- Phase 19 (part 2): rematches. A participant of a game can invite the opponent to a new game with the colours swapped.
-- The invitation is a 'waiting' game whose other seat is reserved for the invited user (invited_id); only that user can
-- accept it, and the invited user can read the waiting game (names only) so it shows in their list.
-- The database does not know when a game ended by checkmate, so a rematch may be offered from any started game
-- (one open rematch per game; the 20-open-games cap still applies).

alter table public.mp_games
  add column invited_id uuid references auth.users (id) on delete cascade,
  add column rematch_of uuid references public.mp_games (id) on delete set null;
create unique index mp_games_one_rematch on public.mp_games (rematch_of)
  where rematch_of is not null and status <> 'cancelled';
create index mp_games_invited_idx on public.mp_games (invited_id) where invited_id is not null;

drop policy mp_games_select on public.mp_games;
create policy mp_games_select on public.mp_games for select to authenticated
  using ((select auth.uid()) in (white_id, black_id, invited_id));

create or replace function public.mp_rematch(game uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype; opp uuid; gid uuid; me text; them text; i_white boolean;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then raise exception 'Game not found'; end if;
  if g.status not in ('active','resigned','draw') or cardinality(g.moves) = 0 then
    raise exception 'A rematch can only follow a game that was played';
  end if;
  if exists (select 1 from public.mp_games r where r.rematch_of = game and r.status <> 'cancelled') then
    raise exception 'A rematch has already been offered';
  end if;
  if (select count(*) from public.mp_games x where x.creator_id = uid and x.status in ('waiting','active')) >= 20 then
    raise exception 'You have too many open games. Finish or cancel some first.';
  end if;
  opp := case when uid = g.white_id then g.black_id else g.white_id end;
  i_white := uid = g.black_id;                       -- colours swap
  me := public.mp_display_name(uid);
  them := public.mp_display_name(opp);
  insert into public.mp_games (creator_id, white_id, black_id, white_name, black_name, invited_id, rematch_of)
  values (uid,
          case when i_white then uid end, case when i_white then null else uid end,
          case when i_white then me else them end, case when i_white then them else me end,
          opp, game)
  returning id into gid;
  return gid;
end $$;

create or replace function public.mp_accept(game uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game and status = 'waiting' for update;
  if not found or g.invited_id is distinct from uid then raise exception 'This invitation is not valid any more'; end if;
  update public.mp_games set
    white_id = coalesce(white_id, uid), black_id = coalesce(black_id, uid),
    invited_id = null, invite_code = null, status = 'active', updated_at = now()
  where id = game;
  return game;
end $$;

-- The invited user may also decline: that cancels the waiting game.
create or replace function public.mp_decline(game uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Sign in first'; end if;
  update public.mp_games set status = 'cancelled', invited_id = null, updated_at = now()
  where id = game and status = 'waiting' and invited_id = uid;
  if not found then raise exception 'This invitation is not valid any more'; end if;
end $$;

-- mp_resign (creator cancels a waiting game) must also clear the reservation.
create or replace function public.mp_resign(game uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then raise exception 'Game not found'; end if;
  if g.status = 'waiting' and g.creator_id = uid then
    update public.mp_games set status = 'cancelled', invite_code = null, invited_id = null, updated_at = now() where id = game;
  elsif g.status = 'active' then
    update public.mp_games set status = 'resigned', resigned_by = uid, draw_offer_by = null, updated_at = now() where id = game;
  else
    raise exception 'This game is already finished';
  end if;
end $$;

revoke all on function public.mp_rematch(uuid), public.mp_accept(uuid), public.mp_decline(uuid) from public, anon;
grant execute on function public.mp_rematch(uuid), public.mp_accept(uuid), public.mp_decline(uuid) to authenticated;
