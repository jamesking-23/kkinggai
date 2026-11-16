-- Phase 11 close-out: a Sports overview module. No new tables; it only reads the sports modules' own data.
insert into public.module_registry (id, name, description, version, status, nav_label, nav_href, nav_icon, nav_order) values
  ('sports', 'Sports', 'Overview of your sports modules', '0.1.0', 'active', 'Sports', '/sports', 'trophy', 68);

insert into public.workspace_modules (workspace_id, module_id)
select w.id, 'sports' from public.workspaces w
on conflict do nothing;
