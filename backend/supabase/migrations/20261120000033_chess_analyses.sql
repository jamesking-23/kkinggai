-- Saved engine analysis of a chess game (one per game), so a game does not have to be re-analysed each visit.
-- Private per user, soft delete only. The evaluations come from the in-browser engine; the server checks their shape
-- and that there is exactly one per position, but cannot check that the numbers are right.

create table public.chess_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id uuid not null,
  depth int not null check (depth between 1 and 60),
  evals jsonb not null check (jsonb_typeof(evals) = 'array' and jsonb_array_length(evals) between 1 and 1001 and octet_length(evals::text) <= 400000),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chess_analyses_game_fk foreign key (game_id, user_id) references public.chess_games (id, user_id) on delete cascade
);
create unique index chess_analyses_game_uniq on public.chess_analyses (user_id, game_id) where deleted_at is null;

create trigger chess_analyses_rev before update on public.chess_analyses for each row execute function public.bump_revision();

alter table public.chess_analyses enable row level security;
create policy chess_analyses_select on public.chess_analyses for select to authenticated using (user_id = (select auth.uid()));
create policy chess_analyses_insert on public.chess_analyses for insert to authenticated with check (user_id = (select auth.uid()));
create policy chess_analyses_update on public.chess_analyses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- no delete policy: soft-deleted via deleted_at
