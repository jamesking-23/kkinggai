-- Phase 8: AI core, conversation storage (DRAFT: not applied until reviewed)
-- Conversations are private to their creator (like the Vault) but tied to a workspace so later phases can
-- scope context. Model calls happen server-side only; this migration stores no API keys.

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 200),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index ai_conversations_owner_idx on public.ai_conversations (owner_id, updated_at desc)
  where deleted_at is null;

create trigger ai_conversations_rev before update on public.ai_conversations
  for each row execute function public.bump_revision();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 60000),
  provider text,
  model text,
  input_tokens int check (input_tokens is null or input_tokens >= 0),
  output_tokens int check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now(),
  -- a message can only belong to a conversation with the same owner
  foreign key (conversation_id, owner_id) references public.ai_conversations (id, owner_id) on delete cascade
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy ai_conversations_select on public.ai_conversations for select to authenticated
  using (owner_id = (select auth.uid()));
create policy ai_conversations_insert on public.ai_conversations for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy ai_conversations_update on public.ai_conversations for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

create policy ai_messages_select on public.ai_messages for select to authenticated
  using (owner_id = (select auth.uid()));
create policy ai_messages_insert on public.ai_messages for insert to authenticated
  with check (owner_id = (select auth.uid()));
-- no update/delete policies: messages are immutable; conversations are soft-deleted via deleted_at

insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('assistant', 'Assistant', 'Chat with the KKINGG AI assistant', '0.1.0', 'active', 'Assistant', '/assistant', 'sparkles', 5);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'assistant' from public.workspaces w
on conflict do nothing;
