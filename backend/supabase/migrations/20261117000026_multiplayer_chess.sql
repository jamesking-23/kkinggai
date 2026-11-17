-- Phase 19 (multiplayer chess, part 1): invite-link games between two signed-in users, with moves kept as a UCI list.
-- Players may only READ their own games. Every write goes through the SECURITY DEFINER functions below, which enforce
-- participation, turn order, the move counter and the game state. The database does NOT know the rules of chess: move
-- legality is checked by the web server (chess.js) before it calls mp_move, and every client replays the full move list and
-- flags an illegal one. A player who calls the API directly could therefore submit an illegal move; it would be detected
-- and shown as such, but not prevented. Checkmate, stalemate and draws by rule are derived from the moves, never stored.
-- Not built: clocks, ratings, rematches, spectators.

create table public.mp_games (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  white_id uuid references auth.users (id) on delete cascade,
  black_id uuid references auth.users (id) on delete cascade,
  white_name text check (white_name is null or char_length(white_name) between 1 and 60),
  black_name text check (black_name is null or char_length(black_name) between 1 and 60),
  invite_code text unique check (invite_code is null or invite_code ~ '^[0-9a-f]{32}$'),
  moves text[] not null default '{}' check (cardinality(moves) <= 600),
  status text not null default 'waiting' check (status in ('waiting','active','resigned','draw','cancelled')),
  resigned_by uuid references auth.users (id) on delete set null,
  draw_offer_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (white_id is not null or black_id is not null),
  check (white_id is distinct from black_id),
  check (creator_id = white_id or creator_id = black_id)
);
create index mp_games_white_idx on public.mp_games (white_id, updated_at desc);
create index mp_games_black_idx on public.mp_games (black_id, updated_at desc);

alter table public.mp_games enable row level security;
create policy mp_games_select on public.mp_games for select to authenticated
  using ((select auth.uid()) in (white_id, black_id));
revoke insert, update, delete on public.mp_games from authenticated, anon;

create or replace function public.mp_display_name(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select left(coalesce(nullif(btrim(p.display_name), ''), split_part(u.email, '@', 1), 'Player'), 60)
  from auth.users u left join public.profiles p on p.id = u.id where u.id = uid
$$;

create or replace function public.mp_create(color text)
returns table (id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); code text; gid uuid; nm text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if color not in ('white','black') then raise exception 'Choose white or black'; end if;
  if (select count(*) from public.mp_games g where g.creator_id = uid and g.status in ('waiting','active')) >= 20 then
    raise exception 'You have too many open games. Finish or cancel some first.';
  end if;
  code := encode(extensions.gen_random_bytes(16), 'hex');
  nm := public.mp_display_name(uid);
  insert into public.mp_games (creator_id, white_id, black_id, white_name, black_name, invite_code)
  values (uid,
          case when color = 'white' then uid end, case when color = 'black' then uid end,
          case when color = 'white' then nm end,  case when color = 'black' then nm end,
          code)
  returning mp_games.id into gid;
  return query select gid, code;
end $$;

create or replace function public.mp_join(code text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype; nm text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where invite_code = code and status = 'waiting' for update;
  if not found then raise exception 'This invite link is not valid any more'; end if;
  if g.creator_id = uid then raise exception 'You cannot join your own game'; end if;
  nm := public.mp_display_name(uid);
  update public.mp_games set
    white_id = coalesce(white_id, uid), black_id = coalesce(black_id, uid),
    white_name = coalesce(white_name, nm), black_name = coalesce(black_name, nm),
    invite_code = null, status = 'active', updated_at = now()
  where id = g.id;
  return g.id;
end $$;

create or replace function public.mp_move(game uuid, expected_ply int, uci text)
returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype; ply int; mover uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then
    raise exception 'Game not found';
  end if;
  if g.status <> 'active' then raise exception 'This game is not in progress'; end if;
  ply := cardinality(g.moves);
  if ply <> expected_ply then raise exception 'The board changed. Reload and try again.'; end if;
  mover := case when ply % 2 = 0 then g.white_id else g.black_id end;
  if uid is distinct from mover then raise exception 'It is not your turn'; end if;
  if uci !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then raise exception 'Invalid move'; end if;
  if ply >= 600 then raise exception 'Move limit reached'; end if;
  update public.mp_games set moves = array_append(moves, uci), draw_offer_by = null, updated_at = now() where id = game;
  return ply + 1;
end $$;

create or replace function public.mp_resign(game uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then raise exception 'Game not found'; end if;
  if g.status = 'waiting' and g.creator_id = uid then
    update public.mp_games set status = 'cancelled', invite_code = null, updated_at = now() where id = game;
  elsif g.status = 'active' then
    update public.mp_games set status = 'resigned', resigned_by = uid, draw_offer_by = null, updated_at = now() where id = game;
  else
    raise exception 'This game is already finished';
  end if;
end $$;

create or replace function public.mp_draw(game uuid, action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); g public.mp_games%rowtype;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into g from public.mp_games where id = game for update;
  if not found or (uid is distinct from g.white_id and uid is distinct from g.black_id) then raise exception 'Game not found'; end if;
  if g.status <> 'active' then raise exception 'This game is not in progress'; end if;
  if action = 'offer' then
    update public.mp_games set draw_offer_by = uid, updated_at = now() where id = game;
  elsif action = 'accept' then
    if g.draw_offer_by is null or g.draw_offer_by = uid then raise exception 'There is no draw offer to accept'; end if;
    update public.mp_games set status = 'draw', draw_offer_by = null, updated_at = now() where id = game;
  elsif action = 'decline' then
    if g.draw_offer_by is null or g.draw_offer_by = uid then raise exception 'There is no draw offer to decline'; end if;
    update public.mp_games set draw_offer_by = null, updated_at = now() where id = game;
  else
    raise exception 'Unknown action';
  end if;
end $$;

revoke all on function public.mp_display_name(uuid) from public, anon, authenticated;
revoke all on function public.mp_create(text) from public, anon;
revoke all on function public.mp_join(text) from public, anon;
revoke all on function public.mp_move(uuid, int, text) from public, anon;
revoke all on function public.mp_resign(uuid) from public, anon;
revoke all on function public.mp_draw(uuid, text) from public, anon;
grant execute on function public.mp_create(text) to authenticated;
grant execute on function public.mp_join(text) to authenticated;
grant execute on function public.mp_move(uuid, int, text) to authenticated;
grant execute on function public.mp_resign(uuid) to authenticated;
grant execute on function public.mp_draw(uuid, text) to authenticated;
