-- Phase 7: Personal Vault (DRAFT: not applied until reviewed)
-- The vault is private to one user: no workspace sharing, no admin access through the API.
-- Files live in a private storage bucket under "<user id>/..."; metadata lives in vault_items.
-- NOTE: this does not add client-side encryption. Data is encrypted at rest by Supabase only.
-- Do not store passwords or recovery codes here until end-to-end encryption exists.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vault', 'vault', false, 26214400, -- 25 MB per file
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/markdown',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('note','file','link')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 20000),   -- note text or link description
  url text check (url is null or url ~* '^https?://'),                 -- for kind = 'link'
  category text check (category is null or char_length(category) <= 60),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  storage_path text,                                                    -- for kind = 'file'
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 26214400),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a file row must point at the owner's own folder; other kinds must not carry a path
  constraint vault_file_path check (
    (kind = 'file' and storage_path is not null and storage_path like owner_id::text || '/%')
    or (kind <> 'file' and storage_path is null)
  ),
  constraint vault_link_url check (kind <> 'link' or url is not null)
);
create index vault_items_owner_idx on public.vault_items (owner_id, kind, created_at desc)
  where deleted_at is null;

create trigger vault_items_rev before update on public.vault_items
  for each row execute function public.bump_revision();

alter table public.vault_items enable row level security;
create policy vault_items_select on public.vault_items for select to authenticated
  using (owner_id = (select auth.uid()));
create policy vault_items_insert on public.vault_items for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy vault_items_update on public.vault_items for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- no delete policy: items are soft-deleted via deleted_at; hard deletion is a deliberate later step

-- Storage: each user can only touch objects under their own "<uid>/" folder in the vault bucket.
create policy vault_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy vault_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy vault_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy vault_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vault' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Register the module and enable it for existing workspaces (new workspaces get defaults from handle_new_user).
insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('vault', 'Vault', 'Private notes, links and documents', '0.1.0', 'active', 'Vault', '/vault', 'lock', 20);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'vault' from public.workspaces w
on conflict do nothing;
