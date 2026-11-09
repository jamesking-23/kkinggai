-- Phase 10 (part 1): academics and spaced-repetition flashcards.
-- Shared workspace tables follow the productivity pattern: members read; owner/admin/member write; viewers read-only;
-- soft delete via deleted_at (no delete policy). card_reviews is private to the reviewer, like habit_logs.

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text check (code is null or char_length(code) <= 30),
  name text not null check (char_length(name) between 1 and 200),
  term text check (term is null or char_length(term) <= 60),
  instructor text check (instructor is null or char_length(instructor) <= 120),
  credits numeric(4,1) check (credits is null or credits >= 0),
  status text not null default 'active' check (status in ('active','completed','dropped')),
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index courses_workspace_idx on public.courses (workspace_id, status) where deleted_at is null;

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  course_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '' check (char_length(description) <= 4000),
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo','in_progress','submitted','graded')),
  score numeric check (score is null or score >= 0),
  max_score numeric not null default 100 check (max_score > 0),
  weight_percent numeric check (weight_percent is null or weight_percent between 0 and 100),
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (course_id, workspace_id) references public.courses (id, workspace_id) on delete cascade
);
create index assignments_workspace_idx on public.assignments (workspace_id, due_at) where deleted_at is null;
create index assignments_course_idx on public.assignments (course_id) where deleted_at is null;

create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  course_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 50000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (course_id, workspace_id) references public.courses (id, workspace_id) on delete set null (course_id)
);
create index study_notes_workspace_idx on public.study_notes (workspace_id, updated_at desc) where deleted_at is null;

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  course_id uuid,
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '' check (char_length(description) <= 1000),
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (course_id, workspace_id) references public.courses (id, workspace_id) on delete set null (course_id)
);
create index flashcard_decks_workspace_idx on public.flashcard_decks (workspace_id) where deleted_at is null;

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  deck_id uuid not null,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 4000),
  ease numeric(4,2) not null default 2.5 check (ease between 1.3 and 4.0),
  interval_days int not null default 0 check (interval_days >= 0),
  repetitions int not null default 0 check (repetitions >= 0),
  lapses int not null default 0 check (lapses >= 0),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (deck_id, workspace_id) references public.flashcard_decks (id, workspace_id) on delete cascade
);
create index flashcards_due_idx on public.flashcards (workspace_id, due_at) where deleted_at is null;
create index flashcards_deck_idx on public.flashcards (deck_id) where deleted_at is null;

create table public.card_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  card_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id),
  rating smallint not null check (rating between 0 and 3), -- 0 again, 1 hard, 2 good, 3 easy
  reviewed_at timestamptz not null default now(),
  foreign key (card_id, workspace_id) references public.flashcards (id, workspace_id) on delete cascade
);
create index card_reviews_user_idx on public.card_reviews (user_id, reviewed_at desc);

create trigger courses_rev before update on public.courses for each row execute function public.bump_revision();
create trigger assignments_rev before update on public.assignments for each row execute function public.bump_revision();
create trigger study_notes_rev before update on public.study_notes for each row execute function public.bump_revision();
create trigger flashcard_decks_rev before update on public.flashcard_decks for each row execute function public.bump_revision();
create trigger flashcards_rev before update on public.flashcards for each row execute function public.bump_revision();

alter table public.courses enable row level security;
alter table public.assignments enable row level security;
alter table public.study_notes enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.card_reviews enable row level security;

do $$
declare t text;
begin
  foreach t in array array['courses','assignments','study_notes','flashcard_decks','flashcards'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_workspace(workspace_id) and created_by is not distinct from (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id))', t || '_update', t);
  end loop;
end $$;

create policy card_reviews_select on public.card_reviews for select to authenticated
  using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy card_reviews_insert on public.card_reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_write_workspace(workspace_id));

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('academics', 'Academics', 'Courses, assignments and study notes', '0.1.0', 'active', 'Academics', '/academics', 'graduation-cap', 60),
  ('flashcards', 'Flashcards', 'Spaced-repetition flashcards', '0.1.0', 'active', 'Flashcards', '/flashcards', 'layers', 62);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, m.id from public.workspaces w cross join (values ('academics'), ('flashcards')) as m(id)
on conflict do nothing;
