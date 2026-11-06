-- Fix: handle_new_user inserted the owner membership that the workspaces_add_owner trigger
-- already creates, causing a duplicate-key failure on every signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  -- The workspaces_add_owner trigger adds the owner membership.
  insert into public.workspaces (name, kind, owner_id)
  values ('Personal', 'personal', new.id) returning id into ws;

  insert into public.user_settings (user_id) values (new.id);

  insert into public.workspace_modules (workspace_id, module_id)
  select ws, id from public.module_registry where status in ('active', 'experimental');
  return new;
end $$;
