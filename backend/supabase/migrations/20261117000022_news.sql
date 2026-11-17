-- Phase 14 (news, part 1): private RSS/Atom feeds and their items. Owner only. Feeds soft delete; items are derived data
-- (no DELETE policy; they are hidden with their feed). Fetching happens server-side only.

create table public.news_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null check (char_length(url) <= 500 and url ~* '^https?://'),
  title text not null default '' check (char_length(title) <= 200),
  topic text check (topic is null or char_length(topic) <= 60),
  last_fetched_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index news_feeds_url_uniq on public.news_feeds (user_id, url) where deleted_at is null;

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_id uuid not null,
  guid text not null check (char_length(guid) between 1 and 500),
  title text not null check (char_length(title) between 1 and 500),
  link text check (link is null or (char_length(link) <= 1000 and link ~* '^https?://')),
  summary text not null default '' check (char_length(summary) <= 1000),
  published_at timestamptz,
  read_at timestamptz,
  saved boolean not null default false,
  revision int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (feed_id, user_id) references public.news_feeds (id, user_id) on delete cascade,
  unique (user_id, feed_id, guid)
);
create index news_items_idx on public.news_items (user_id, published_at desc nulls last);

create trigger news_feeds_rev before update on public.news_feeds for each row execute function public.bump_revision();
create trigger news_items_rev before update on public.news_items for each row execute function public.bump_revision();

alter table public.news_feeds enable row level security;
alter table public.news_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['news_feeds','news_items'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('news', 'News', 'RSS and Atom feeds you choose', '0.1.0', 'active', 'News', '/news', 'newspaper', 85);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'news' from public.workspaces w
on conflict do nothing;
