-- Phase 15 (entertainment, part 1): a private media log (books, films, shows, games, music, podcasts). Owner only, soft delete, no DELETE policy.

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('book','movie','show','game','music','podcast','other')),
  title text not null check (char_length(title) between 1 and 200),
  creator text check (creator is null or char_length(creator) <= 160),
  status text not null default 'wishlist' check (status in ('wishlist','in_progress','done','dropped')),
  rating int check (rating is null or rating between 1 and 5),
  started_on date,
  finished_on date,
  notes text not null default '' check (char_length(notes) <= 4000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (finished_on is null or started_on is null or finished_on >= started_on)
);
create index media_items_user_idx on public.media_items (user_id, status, updated_at desc) where deleted_at is null;

create trigger media_items_rev before update on public.media_items for each row execute function public.bump_revision();

alter table public.media_items enable row level security;
create policy media_items_select on public.media_items for select to authenticated using (user_id = (select auth.uid()));
create policy media_items_insert on public.media_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy media_items_update on public.media_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('entertainment', 'Entertainment', 'Books, films, shows, games and music you track', '0.1.0', 'active', 'Entertainment', '/entertainment', 'film', 95);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'entertainment' from public.workspaces w
on conflict do nothing;
