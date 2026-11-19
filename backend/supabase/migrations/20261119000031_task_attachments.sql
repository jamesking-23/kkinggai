-- Task attachments: files attached to a task, stored in a private bucket under "<workspace id>/<task id>/".
-- Anyone in the workspace can read them; only members who can write (owner, admin, member) can add or remove them.
-- Files up to 4 MB (the hosting request limit; the bucket itself would allow 25 MB). No delete policy: attachments are
-- soft-deleted (deleted_at) and the stored file is kept, like vault files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 26214400,
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null,
  storage_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  created_by uuid not null default auth.uid() references auth.users (id),
  revision int not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, workspace_id) references public.tasks (id, workspace_id) on delete cascade,
  -- the file must sit in this task's own folder
  constraint task_attachment_path check (storage_path like workspace_id::text || '/' || task_id::text || '/%'),
  unique (storage_path)
);
create index task_attachments_task_idx on public.task_attachments (task_id, created_at) where deleted_at is null;

create trigger task_attachments_rev before update on public.task_attachments
  for each row execute function public.bump_revision();

alter table public.task_attachments enable row level security;
create policy task_attachments_select on public.task_attachments for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy task_attachments_insert on public.task_attachments for insert to authenticated
  with check (public.can_write_workspace(workspace_id) and created_by is not distinct from (select auth.uid()));
create policy task_attachments_update on public.task_attachments for update to authenticated
  using (public.can_write_workspace(workspace_id)) with check (public.can_write_workspace(workspace_id));

-- Storage: the first folder of the object name is the workspace id. The case expression keeps a malformed folder name from
-- causing a cast error (it simply denies access).
create policy task_files_select on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_workspace_member(((storage.foldername(name))[1])::uuid) else false end);
create policy task_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.can_write_workspace(((storage.foldername(name))[1])::uuid) else false end);
-- No update or delete policy on task-files objects: files are never overwritten or removed through the API.
