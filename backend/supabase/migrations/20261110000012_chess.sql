-- Phase 11 (chess, part 1): private per-user games and chess profile. No workspace sharing; soft delete only.

create table public.chess_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  player_names text[] not null default '{}' check (cardinality(player_names) <= 10),
  lichess_username text check (lichess_username is null or lichess_username ~ '^[A-Za-z0-9_-]{2,30}$'),
  chesscom_username text check (chesscom_username is null or chesscom_username ~ '^[A-Za-z0-9_-]{2,30}$'),
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chess_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','pgn','lichess','chesscom','multiplayer')),
  external_id text check (external_id is null or char_length(external_id) <= 100),
  white text not null default '?' check (char_length(white) between 1 and 100),
  black text not null default '?' check (char_length(black) between 1 and 100),
  user_color text check (user_color is null or user_color in ('white','black')),
  result text not null default '*' check (result in ('1-0','0-1','1/2-1/2','*')),
  event text check (event is null or char_length(event) <= 200),
  site text check (site is null or char_length(site) <= 200),
  played_on date,
  time_control text check (time_control is null or char_length(time_control) <= 40),
  white_elo int check (white_elo is null or white_elo between 0 and 4000),
  black_elo int check (black_elo is null or black_elo between 0 and 4000),
  eco text check (eco is null or eco ~ '^[A-E][0-9]{2}$'),
  opening text check (opening is null or char_length(opening) <= 200),
  termination text check (termination is null or char_length(termination) <= 100),
  move_count int not null default 0 check (move_count >= 0),
  pgn text not null check (char_length(pgn) between 1 and 200000),
  notes text not null default '' check (char_length(notes) <= 4000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chess_games_user_idx on public.chess_games (user_id, played_on desc nulls last, created_at desc) where deleted_at is null;
create unique index chess_games_external_uniq on public.chess_games (user_id, source, external_id)
  where external_id is not null and deleted_at is null;

create trigger chess_profiles_rev before update on public.chess_profiles for each row execute function public.bump_revision();
create trigger chess_games_rev before update on public.chess_games for each row execute function public.bump_revision();

alter table public.chess_profiles enable row level security;
alter table public.chess_games enable row level security;

do $$
declare t text;
begin
  foreach t in array array['chess_profiles','chess_games'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('chess', 'Chess', 'Game history, PGN import and export, analysis', '0.1.0', 'active', 'Chess', '/chess', 'crown', 70);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'chess' from public.workspaces w
on conflict do nothing;
