# Development Status

## Current phase

Phase 6 (module registry and Idea Inbox) — built and deployed; migration 4 applied. Not yet exercised by a
signed-in user (sandbox cannot reach Supabase). Phase 5 gaps (edit forms, reminders UI, milestones, subtasks,
planning views) are still open.

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

- Phase 6: migration `20261107000004_modules_and_ideas` applied. Database rules: only owners/admins can toggle
  modules; clients cannot insert or delete `workspace_modules` rows; enabling needs dependencies on, disabling is
  blocked while another enabled module needs it and for core modules (Dashboard). `idea_backlog` table with RLS.
  UI: `/settings/modules` (enable/disable with the database's messages relayed) and `/ideas` (capture, filter by
  status, change status, soft delete; priority, category, related module, notes). Disabled modules redirect home.
  Voice capture for ideas waits for the voice phase.
- Access-rule SQL test `rls_modules_ideas.sql`: 19 checks, all as expected. Unit tests now 38.

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

- Phase 5 gaps still open: task recurrence and attachments, edit forms for projects/goals/events, project
  milestones, daily/weekly planning views, activity history, dashboard widget configuration. Reminder delivery
  (push/email) needs Phase 16; reminders only show on the dashboard when due.
- Database types are hand-saved from the generator in `apps/web/lib/supabase/database.types.ts`; regenerate after each migration.
- No automated tests yet for the server actions or pages themselves.
- Supabase Auth: "leaked password protection" is off (advisor warning); enable it in Authentication settings
  (may need a paid plan).
- Account deletion, data export, password change from settings.
- Notifications bell and AI assistant button are intentionally absent until their backends exist
  (Phases 8 and 16). The top-bar search only finds modules until universal search (Phase 9).
- Shell components (sidebar, menus) have no automated component tests yet; only logic is unit tested.
- `apps/mobile`, `apps/desktop`; storage buckets; Vault storage buckets.
- RLS tests are manual, not in CI. GitHub Actions not yet observed running.

## Exact next action

Owner tries sign-up/sign-in and the shell locally (`pnpm --filter @kkingg/web dev`) and reports problems.
Then Phase 7 (Personal Vault: storage bucket and tables; SQL is shown for review before applying).

## Update: task detail, milestones, reminders (code written, not exercised against a live database)

- `/tasks/[id]`: edit details (revision-guarded), one-level subtasks with completion history, per-task reminders.
- Goals: add and complete milestones. Dashboard: "Reminders due" card with dismiss.
- Verified: lint, format check, typecheck, 41 unit tests and production build pass. The new pages and actions have
  not been run signed in because the sandbox cannot reach Supabase.

## Update: Phase 7 draft (not applied)

- `backend/supabase/migrations/20261107000005_vault.sql` is a DRAFT awaiting the owner's review. It has NOT been applied to
  the `kkingg-ai` database, so the Vault does not exist yet. No vault UI or tests are written.
