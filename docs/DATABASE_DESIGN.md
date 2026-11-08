# Database Design

Supabase project `kkingg-ai` (`rlinlmnpzrlbprmcejdk`). Migrations live in `backend/supabase/migrations`
and have been applied to the project.

## Applied (Phase 2 foundation)

Tables: `profiles`, `workspaces`, `workspace_members`, `module_registry`, `workspace_modules`,
`user_settings`, `audit_logs`. Enums: `workspace_kind`, `workspace_role`, `module_status`.

- Signup trigger (`handle_new_user`) creates the profile, a "Personal" workspace, settings and default modules.
  The `workspaces_add_owner` trigger adds the owner membership.
- Helper functions `is_workspace_member` and `has_workspace_role` are SECURITY DEFINER to avoid RLS recursion.
  They are callable through the API by signed-in users and only reveal the caller's own membership
  (accepted advisor warning).
- RLS is enabled on every table. The `owner` role cannot be granted or changed through the API.
  `module_registry` is read-only to clients. `audit_logs` is append-only for clients.

## Applied (Phase 5 productivity)

Migration `20261107000003_productivity`: `projects`, `goals`, `milestones`, `tasks`, `task_completions`,
`events`, `reminders`, `habits`, `habit_logs`. Cross-references use composite `(id, workspace_id)` foreign
keys so a record can never point into another workspace. Tasks, goals, projects and events carry a
`revision` (bumped by trigger) and tasks/events a `deleted_at` marker for the later sync layer.
Access: members read shared tables; owner/admin/member write; viewers are read-only; reminders, habits and
habit logs are private to their creator. `can_write_workspace` is a SECURITY DEFINER helper (same accepted
advisor warning as the other helpers).

## Applied (Phase 6)

Migration `20261107000004_modules_and_ideas`: `module_registry.core`, update-only policy on `workspace_modules`
with the `enforce_module_rules` trigger (runs as the invoker, no security-definer exposure), and `idea_backlog`
(workspace-scoped, revision and soft-delete, statuses captured/planned/in_development/active/experimental/
deprecated, optional related module).

## Applied (Phase 7)

Migration `20261107000005_vault`: private `vault` storage bucket (25 MB, allowed types listed in the migration) and
`vault_items` (notes, links, files). Owner-only: no workspace sharing. Files live under `<user id>/`; policies on
`storage.objects` and a check constraint keep paths inside the owner folder. No delete policy: soft delete only.

## Not yet done

All productivity/AI/vault tables, notifications, sync metadata.

## Tests

`backend/supabase/tests/rls_foundation.sql` and `rls_productivity.sql` — run in the SQL editor; they roll back and
report results. Last runs: all checks passed (see `TESTING.md`).
