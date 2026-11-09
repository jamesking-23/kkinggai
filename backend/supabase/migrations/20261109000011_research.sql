-- Phase 10: research library (shared in the workspace like study notes) and search over it.

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  course_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  authors text check (authors is null or char_length(authors) <= 300),
  published_year smallint check (published_year is null or published_year between 1000 and 2200),
  kind text not null default 'article' check (kind in ('paper','book','article','website','report','other')),
  url text check (url is null or url ~* '^https?://'),
  status text not null default 'to_read' check (status in ('to_read','reading','read')),
  summary text not null default '' check (char_length(summary) <= 20000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (course_id, workspace_id) references public.courses (id, workspace_id) on delete set null (course_id)
);
create index research_sources_workspace_idx on public.research_sources (workspace_id, status, updated_at desc) where deleted_at is null;

create trigger research_sources_rev before update on public.research_sources for each row execute function public.bump_revision();

alter table public.research_sources enable row level security;
create policy research_sources_select on public.research_sources for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy research_sources_insert on public.research_sources for insert to authenticated
  with check (public.can_write_workspace(workspace_id) and created_by is not distinct from (select auth.uid()));
create policy research_sources_update on public.research_sources for update to authenticated
  using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));

create or replace function public.search_workspace(ws uuid, q text, per_kind int default 8)
returns table (kind text, id uuid, title text, snippet text, href text)
language sql stable security invoker set search_path = ''
as $$
  with p as (
    select '%' || replace(replace(replace(left(btrim(q), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat,
           least(greatest(per_kind, 1), 20) as lim
    where char_length(btrim(q)) >= 2 and public.is_workspace_member(ws)
  )
  select * from (
    select 'task'::text, t.id, t.title, left(t.description, 140), '/tasks/' || t.id
    from public.tasks t, p
    where t.workspace_id = ws and t.deleted_at is null
      and (t.title ilike p.pat or t.description ilike p.pat)
    order by t.updated_at desc limit (select lim from p)
  ) a
  union all select * from (
    select 'project'::text, j.id, j.name, left(j.description, 140), '/projects'
    from public.projects j, p
    where j.workspace_id = ws and (j.name ilike p.pat or j.description ilike p.pat)
    order by j.updated_at desc limit (select lim from p)
  ) b
  union all select * from (
    select 'goal'::text, g.id, g.title, left(g.description, 140), '/goals'
    from public.goals g, p
    where g.workspace_id = ws and (g.title ilike p.pat or g.description ilike p.pat)
    order by g.updated_at desc limit (select lim from p)
  ) c
  union all select * from (
    select 'event'::text, e.id, e.title, left(coalesce(e.location, e.description), 140), '/calendar'
    from public.events e, p
    where e.workspace_id = ws and e.deleted_at is null
      and (e.title ilike p.pat or e.description ilike p.pat or e.location ilike p.pat)
    order by e.starts_at desc limit (select lim from p)
  ) d
  union all select * from (
    select 'idea'::text, i.id, i.title, left(i.description, 140), '/ideas'
    from public.idea_backlog i, p
    where i.workspace_id = ws and i.deleted_at is null
      and (i.title ilike p.pat or i.description ilike p.pat or i.notes ilike p.pat)
    order by i.updated_at desc limit (select lim from p)
  ) e
  union all select * from (
    select 'habit'::text, h.id, h.name, ''::text, '/habits'
    from public.habits h, p
    where h.workspace_id = ws and h.archived_at is null and h.name ilike p.pat
    order by h.created_at desc limit (select lim from p)
  ) f
  union all select * from (
    select 'vault'::text, v.id, v.title, left(v.body, 140), '/vault'
    from public.vault_items v, p
    where v.owner_id = (select auth.uid()) and v.deleted_at is null
      and (v.title ilike p.pat or v.body ilike p.pat or array_to_string(v.tags, ' ') ilike p.pat)
    order by v.updated_at desc limit (select lim from p)
  ) g
  union all select * from (
    select 'conversation'::text, c.id, c.title, ''::text, '/assistant?c=' || c.id
    from public.ai_conversations c, p
    where c.owner_id = (select auth.uid()) and c.workspace_id = ws and c.deleted_at is null
      and c.title ilike p.pat
    order by c.updated_at desc limit (select lim from p)
  ) h
  union all select * from (
    select 'course'::text, k.id, k.name, left(coalesce(k.code || ' ' , '') || coalesce(k.instructor, ''), 140), '/academics'
    from public.courses k, p
    where k.workspace_id = ws and k.deleted_at is null
      and (k.name ilike p.pat or k.code ilike p.pat or k.instructor ilike p.pat)
    order by k.updated_at desc limit (select lim from p)
  ) i
  union all select * from (
    select 'study_note'::text, n.id, n.title, left(n.body, 140), '/academics'
    from public.study_notes n, p
    where n.workspace_id = ws and n.deleted_at is null
      and (n.title ilike p.pat or n.body ilike p.pat or array_to_string(n.tags, ' ') ilike p.pat)
    order by n.updated_at desc limit (select lim from p)
  ) j
  union all select * from (
    select 'deck'::text, d.id, d.name, left(d.description, 140), '/flashcards'
    from public.flashcard_decks d, p
    where d.workspace_id = ws and d.deleted_at is null and (d.name ilike p.pat or d.description ilike p.pat)
    order by d.updated_at desc limit (select lim from p)
  ) k2
  union all select * from (
    select 'card'::text, f.id, f.front, left(f.back, 140), '/flashcards'
    from public.flashcards f, p
    where f.workspace_id = ws and f.deleted_at is null and (f.front ilike p.pat or f.back ilike p.pat)
    order by f.updated_at desc limit (select lim from p)
  ) l
  union all select * from (
    select 'application'::text, a.id, a.company || ' · ' || a.role, left(a.notes, 140), '/career'
    from public.job_applications a, p
    where a.user_id = (select auth.uid()) and a.deleted_at is null
      and (a.company ilike p.pat or a.role ilike p.pat or a.notes ilike p.pat)
    order by a.updated_at desc limit (select lim from p)
  ) m
  union all select * from (
    select 'interview'::text, q.id, q.question, left(q.answer, 140), '/career'
    from public.interview_prep q, p
    where q.user_id = (select auth.uid()) and q.deleted_at is null
      and (q.question ilike p.pat or q.answer ilike p.pat)
    order by q.updated_at desc limit (select lim from p)
  ) n2
  union all select * from (
    select 'portfolio'::text, o.id, o.title, left(o.description, 140), '/career'
    from public.portfolio_items o, p
    where o.user_id = (select auth.uid()) and o.deleted_at is null
      and (o.title ilike p.pat or o.description ilike p.pat or array_to_string(o.tags, ' ') ilike p.pat)
    order by o.updated_at desc limit (select lim from p)
  ) o2
  union all select * from (
    select 'research'::text, r.id, r.title, left(coalesce(r.authors || ' ', '') || r.summary, 140), '/academics/research'
    from public.research_sources r, p
    where r.workspace_id = ws and r.deleted_at is null
      and (r.title ilike p.pat or r.authors ilike p.pat or r.summary ilike p.pat or array_to_string(r.tags, ' ') ilike p.pat)
    order by r.updated_at desc limit (select lim from p)
  ) p2
;
$$;

revoke execute on function public.search_workspace(uuid, text, int) from public, anon;
grant execute on function public.search_workspace(uuid, text, int) to authenticated;
