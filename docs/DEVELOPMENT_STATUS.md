# Development Status

## Current phase

Phase 6 (module registry and Idea Inbox) — IN PROGRESS. Draft migration
`backend/supabase/migrations/20261107000004_modules_and_ideas.sql` is written but NOT applied to `kkingg-ai`
and has not been dry-run (the database tool's confirmation prompt for its `DROP POLICY` expired).
Do not build the UI that depends on it until the owner approves and it is applied; then regenerate
`apps/web/lib/supabase/database.types.ts` (adds `module_registry.core` and `idea_backlog`).

Phase 4 (app shell and design system) — code complete. Phase 3 auth and the signed-in shell have NOT been
verified against live Supabase (the sandbox cannot reach it); please try them locally.

## Completed

- Phase 0 audit; Phase 1 foundation; Phase 2 backend (migrations applied, RLS tests passing).
- Phase 3 code: register, login, logout, forgot/reset password, auth callback, protected routes via
  middleware, profile and workspace loaded on the home page. Shared zod schemas in `@kkingg/schemas`.
  Unsafe redirect targets are rejected; forgot-password gives the same response for any email.
- Verified locally: lint, format, typecheck, 16 unit tests, `next build`. Against a running production
  build: `/` and `/tasks` redirect to `/login` when signed out, auth pages return 200, a bad callback
  redirects to `/login` with an error and ignores an unsafe `next`.

- Phase 4 code: Tailwind v4 theme mirroring the design tokens; responsive shell (collapsible sidebar,
  mobile drawer, top bar) with navigation generated from the registry plus the workspace's enabled modules
  (`workspace_modules`); working workspace switcher (cookie validated against RLS-visible workspaces);
  account menu with sign out; settings page to edit name and time zone; module search (jumps to modules).

- Phase 5 code: tasks (create, complete/reopen with completion history, soft delete, project/category/priority,
  due dates in the user's time zone), projects (status changes, open-task counts), goals (target, progress
  updates, achieve/abandon), habits (private, daily log, streaks), calendar (month grid, events, open tasks on
  due dates), and a dashboard showing real data only. Edits use the stored `revision` as an optimistic lock:
  a stale edit is rejected with a message instead of overwriting a newer change.
- Verified: lint, format, typecheck, 34 unit tests (time zones, streaks, progress, schemas), production build;
  signed-out requests to every new route redirect to `/login`. Database access rules were tested in SQL.

## Not verified

- Real registration, login and password reset against Supabase Auth: the sandbox network blocks the
  Supabase domain from the shell (403 from the proxy), so this must be tried from your machine.
  The signup database trigger itself was verified in SQL (RLS test creates users in `auth.users`).
- Email delivery and confirmation flow.

## Required configuration (owner)

- In Supabase Auth settings: set Site URL and add redirect URLs (`http://localhost:3000/auth/callback`
  and the production URL); decide whether email confirmation is required. Not set by me.
- Local env: `apps/web/.env.local` (gitignored) holds the project URL and publishable key; copy from `.env.example`.
- Revoke the GitHub token that was pasted in chat.

## Not yet done

- Phase 5 gaps: no UI yet for subtasks, task recurrence, task attachments, milestones, reminders, editing
  existing items (only create, status changes and delete), daily/weekly planning views, activity history, or
  dashboard widget configuration. Tables for these exist; reminder delivery needs Phase 16.
- Database types are hand-saved from the generator in `apps/web/lib/supabase/database.types.ts`; regenerate after each migration.
- No automated tests yet for the server actions or pages themselves.
- Account deletion, data export, password change from settings.
- Notifications bell and AI assistant button are intentionally absent until their backends exist
  (Phases 8 and 16). The top-bar search only finds modules until universal search (Phase 9).
- Shell components (sidebar, menus) have no automated component tests yet; only logic is unit tested.
- `apps/mobile`, `apps/desktop`; storage buckets; Vault storage buckets.
- RLS tests are manual, not in CI. GitHub Actions not yet observed running.

## Exact next action

Owner tries sign-up/sign-in and the shell locally (`pnpm --filter @kkingg/web dev`) and reports problems.
Then finish Phase 5 gaps (edit forms, reminders UI, milestones, subtasks, planning views, generated DB types), then
Phase 6: module registry UI (activate/deactivate modules) and Idea Inbox.
