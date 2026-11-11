-- Phase 11 (chess, part 3b): puzzles made from the user's own mistakes. Private per user, soft delete only.
-- The position and the played move are derived server-side from the stored game; solution_uci is the in-browser engine's best move.

alter table public.chess_games add constraint chess_games_id_user_unique unique (id, user_id);

create table public.chess_puzzles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id uuid not null,
  ply int not null check (ply between 1 and 1000),
  fen text not null check (char_length(fen) between 20 and 100),
  side_to_move text not null check (side_to_move in ('white','black')),
  solution_uci text not null check (solution_uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  played_uci text not null check (played_uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  loss_cp int not null check (loss_cp between 0 and 3000),
  depth int not null default 0 check (depth between 0 and 60),
  box int not null default 0 check (box between 0 and 5),
  attempts int not null default 0 check (attempts >= 0),
  correct int not null default 0 check (correct >= 0 and correct <= attempts),
  next_due_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chess_puzzles_game_fk foreign key (game_id, user_id) references public.chess_games (id, user_id) on delete cascade
);
create unique index chess_puzzles_game_ply_uniq on public.chess_puzzles (user_id, game_id, ply) where deleted_at is null;
create index chess_puzzles_due_idx on public.chess_puzzles (user_id, next_due_at) where deleted_at is null;

create trigger chess_puzzles_rev before update on public.chess_puzzles for each row execute function public.bump_revision();

alter table public.chess_puzzles enable row level security;
create policy chess_puzzles_select on public.chess_puzzles for select to authenticated using (user_id = (select auth.uid()));
create policy chess_puzzles_insert on public.chess_puzzles for insert to authenticated with check (user_id = (select auth.uid()));
create policy chess_puzzles_update on public.chess_puzzles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- no delete policy: puzzles are soft-deleted via deleted_at
