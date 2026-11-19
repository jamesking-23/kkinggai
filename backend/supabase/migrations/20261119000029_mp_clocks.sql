-- Phase 19 (part 3): chess clocks for multiplayer games.
-- A game is untimed (clock_seconds null) or timed with a base time per side and an increment per move.
-- The server keeps the remaining time of each side (white_ms, black_ms) and when the running clock started (clock_started_at).
-- The first move of each side is free: the clocks only run once both sides have moved (cardinality(moves) >= 2), then the
-- side to move is the one whose clock runs. Time is measured with the database clock, never the browser's.
-- A player who runs out of time loses when either (a) they try to move (mp_move records the loss instead of the move) or
-- (b) the opponent claims it with mp_claim_timeout. Nothing flags a game by itself, so an abandoned game stays 'active'
-- until the opponent claims. Not handled: a timeout win against a side with insufficient material is not scored as a draw.

alter table public.mp_games
  add column clock_seconds int check (clock_seconds is null or clock_seconds between 60 and 10800),
  add column clock_increment int not null default 0 check (clock_increment between 0 and 60),
  add column white_ms bigint,
  add column black_ms bigint,
  add column clock_started_at timestamptz,
  add column timed_out_by uuid references auth.users (id) on delete set null,
  add constraint mp_games_clock_consistent check (
    (clock_seconds is null and white_ms is null and black_ms is null)
    or (clock_seconds is not null and white_ms is not null and black_ms is not null));

alter table public.mp_games drop constraint mp_games_status_check;
alter table public.mp_games add constraint mp_games_status_check
  check (status in ('waiting','active','resigned','draw','cancelled','timeout'));

-- mp_create gains the time control; the old signature goes away so no unchecked overload stays callable.
drop function public.mp_create(text);
create function public.mp_create(color text, minutes int default null, increment int default 0)
returns table (id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); code text; gid uuid; nm text; secs int;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if color not in ('white','black') then raise exception 'Choose white or black'; end if;
  if minutes is not null and (minutes < 1 or minutes > 180) then raise exception 'Choose between 1 and 180 minutes'; end if;
  if increment < 0 or increment > 60 then raise exception 'The increment must be between 0 and 60 seconds'; end if;
  secs := minutes * 60;
  if (select count(*) from public.mp_games g where g.creator_id = uid and g.status in ('waiting','active')) >= 20 then
    raise exception 'You have too many open games. Finish or cancel some first.';
  end if;
  code := encode(extensions.gen_random_bytes(16), 'hex');
  nm := public.mp_display_name(uid);
  insert into public.mp_games (creator_id, white_id, black_id, white_name, black_name, invite_code,
                               clock_seconds, clock_increment, white_ms, black_ms)
  values (uid,
          case when color = 'white' then uid end, case when color = 'black' then uid end,
          case when color = 'white' then nm end,  case when color = 'black' then nm end,
          code, secs, case when secs is null then 0 else increment end,
          secs * 1000::bigint, secs * 1000::bigint)
  returning mp_games.id into gid;
  return query select gid, code;
end $$;

create or replace function public.mp_move(game uuid, expected_ply int, uci text)
returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype; ply int; mover uuid; left_ms bigint; white_to_move boolean;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then
    raise exception 'Game not found';
  end if;
  if g.status <> 'active' then raise exception 'This game is not in progress'; end if;
  ply := cardinality(g.moves);
  if ply <> expected_ply then raise exception 'The board changed. Reload and try again.'; end if;
  white_to_move := ply % 2 = 0;
  mover := case when white_to_move then g.white_id else g.black_id end;
  if uid is distinct from mover then raise exception 'It is not your turn'; end if;
  if uci !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then raise exception 'Invalid move'; end if;
  if ply >= 600 then raise exception 'Move limit reached'; end if;

  if g.clock_seconds is null or ply < 2 then
    update public.mp_games set moves = array_append(moves, uci), draw_offer_by = null,
      clock_started_at = now(), updated_at = now() where id = game;
    return ply + 1;
  end if;

  left_ms := (case when white_to_move then g.white_ms else g.black_ms end)
             - floor(extract(epoch from (now() - g.clock_started_at)) * 1000)::bigint;
  if left_ms <= 0 then
    -- The move is not recorded: the mover ran out of time first.
    update public.mp_games set status = 'timeout', timed_out_by = mover, draw_offer_by = null, updated_at = now(),
      white_ms = case when white_to_move then 0 else white_ms end,
      black_ms = case when white_to_move then black_ms else 0 end
    where id = game;
    return ply;
  end if;
  update public.mp_games set moves = array_append(moves, uci), draw_offer_by = null,
    white_ms = case when white_to_move then left_ms + g.clock_increment * 1000 else white_ms end,
    black_ms = case when white_to_move then black_ms else left_ms + g.clock_increment * 1000 end,
    clock_started_at = now(), updated_at = now()
  where id = game;
  return ply + 1;
end $$;

create function public.mp_claim_timeout(game uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype; ply int; white_to_move boolean; left_ms bigint; slow uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then raise exception 'Game not found'; end if;
  if g.status <> 'active' then raise exception 'This game is not in progress'; end if;
  ply := cardinality(g.moves);
  if g.clock_seconds is null or ply < 2 then raise exception 'The clock is not running'; end if;
  white_to_move := ply % 2 = 0;
  slow := case when white_to_move then g.white_id else g.black_id end;
  if slow = uid then raise exception 'You cannot claim a win on your own clock'; end if;
  left_ms := (case when white_to_move then g.white_ms else g.black_ms end)
             - floor(extract(epoch from (now() - g.clock_started_at)) * 1000)::bigint;
  if left_ms > 0 then raise exception 'The clock has not run out yet'; end if;
  update public.mp_games set status = 'timeout', timed_out_by = slow, draw_offer_by = null, updated_at = now(),
    white_ms = case when white_to_move then 0 else white_ms end,
    black_ms = case when white_to_move then black_ms else 0 end
  where id = game;
end $$;

-- Rematches keep the time control; a rematch may also follow a game lost on time.
create or replace function public.mp_rematch(game uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype; opp uuid; gid uuid; me text; them text; i_white boolean;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then raise exception 'Game not found'; end if;
  if g.status not in ('active','resigned','draw','timeout') or cardinality(g.moves) = 0 then
    raise exception 'A rematch can only follow a game that was played';
  end if;
  if exists (select 1 from public.mp_games r where r.rematch_of = game and r.status <> 'cancelled') then
    raise exception 'A rematch has already been offered';
  end if;
  if (select count(*) from public.mp_games x where x.creator_id = uid and x.status in ('waiting','active')) >= 20 then
    raise exception 'You have too many open games. Finish or cancel some first.';
  end if;
  opp := case when uid = g.white_id then g.black_id else g.white_id end;
  i_white := uid = g.black_id;
  me := public.mp_display_name(uid);
  them := public.mp_display_name(opp);
  insert into public.mp_games (creator_id, white_id, black_id, white_name, black_name, invited_id, rematch_of,
                               clock_seconds, clock_increment, white_ms, black_ms)
  values (uid,
          case when i_white then uid end, case when i_white then null else uid end,
          case when i_white then me else them end, case when i_white then them else me end,
          opp, game,
          g.clock_seconds, g.clock_increment,
          g.clock_seconds * 1000::bigint, g.clock_seconds * 1000::bigint)
  returning id into gid;
  return gid;
end $$;

revoke all on function public.mp_create(text, int, int), public.mp_claim_timeout(uuid) from public, anon;
grant execute on function public.mp_create(text, int, int), public.mp_claim_timeout(uuid) to authenticated;
