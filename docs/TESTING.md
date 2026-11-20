# Testing

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.

Automated tests: module registry (4), design tokens (1), AI providers (12), schemas (29), web logic (36).

## Database / RLS

`backend/supabase/tests/rls_foundation.sql` creates two users inside a transaction, checks isolation,
then rolls back. It must be run manually (not in CI yet). Last run against `kkingg-ai`: 15 checks,
all as expected — cross-workspace reads and writes blocked, self-promotion to owner blocked, registry
read-only, audit logs append-only, anonymous reads return nothing.
`rls_productivity.sql` (3 users: owner, viewer, outsider): 18 checks, all as expected — foreign-workspace writes
and cross-workspace links blocked, `created_by` spoofing blocked, viewers read-only, reminders/habits private,
revision increments on update, outsiders and anonymous users see nothing.
`rls_modules_ideas.sql` (5 users: owner, member, admin, viewer, outsider): 19 checks, all as expected — only
owners/admins toggle modules, clients cannot insert/delete module rows, core and dependency rules enforced,
viewers read-only on ideas, outsiders and anonymous see nothing.
`rls_vault.sql` (3 users): 17 results, all as expected (see DEVELOPMENT_STATUS). Storage-object deletion cannot be
tested in SQL.
`rls_ai.sql` (3 users): 16 results, all as expected.
`rls_search.sql` (3 users): 10 results, all as expected.
`rls_academics.sql` (4 users): 17 results, all as expected. `rls_career.sql` (3 users): 17 results, all as expected.
`rls_research.sql` (4 users): 15 results, all as expected.
`rls_search_academics_career.sql`: 5 results, all as expected; `rls_search.sql` re-run after the change: 10, all as expected.
The first foundation run found a signup bug (duplicate owner membership), fixed in migration 2.

CI is defined in `.github/workflows/ci.yml` but has not been observed running on GitHub.
`rls_chess.sql` (3 users): 15 results, all as expected.

Engine check (manual, not in CI): `lib/engine.ts` bundled with esbuild and run in headless Chromium against the served worker files; see the Phase 11 slice 2 notes in DEVELOPMENT_STATUS.md.
`rls_chess_puzzles.sql` (3 users): 13 results, all as expected.
`rls_running.sql` (3 users): 15 results, all as expected.
`rls_run_plans.sql` (3 users): 15 results, all as expected.
`rls_strava.sql` was removed together with the Strava connection (see the 2026-11-17 note in DEVELOPMENT_STATUS.md). `trackfile.test.ts`: 10 tests (TCX/GPX detection, gzip, FIT rejection, gzip-bomb cap, heart-rate average).
`rls_ventures.sql` (3 users): 15 results, all as expected.
`rls_search_business_sports.sql` (3 users plus anon): 4 results, all as expected.
`rls_venture_contacts_tasks.sql` (3 users plus anon): 15 results, all as expected.
`rls_personal.sql` (3 users plus anon): 16 results, all as expected.
`rls_multiplayer.sql` (3 users plus anon): 30 results, all as expected. `mp.test.ts`: 14 tests.
`rls_mp_rematch.sql` (3 users plus anon): 16 results as expected; the decline path was confirmed in a second run (see DEVELOPMENT_STATUS.md).
`rls_mp_clocks.sql` (3 users plus anon): 16 results as expected (time simulated by moving clock_started_at back; the untimed-claim branch is not exercised). `mp.test.ts` now covers clock maths and formatting.
`rls_news.sql` (3 users plus anon): 15 results, all as expected. `feeds.test.ts`: 14 tests with mocked fetch and DNS only.
`rls_media.sql` (3 users plus anon): 13 results, all as expected.
`rls_notifications.sql` (3 users plus anon): 11 results, all as expected.

`apps/mobile`: `format.test.ts` (4 tests). Android JS bundling checked with `expo export`; the app has not been run on a device or emulator.

`apps/desktop`: 2 Rust unit tests for the navigation allow-list (run on Linux). The Desktop workflow has built Windows installers on `windows-latest` (Rust tests and bundling passed); the installers have not been run.

Unauthenticated smoke test (`pnpm smoke`, manual, not in CI): start the production build locally (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy next start -p 3100` in `apps/web`), then `NODE_PATH=$(npm root -g) pnpm smoke`. Run on 2026-11-18: all 41 page routes checked in headless Chromium; the 37 app routes redirect to /login without a session and the 4 public pages (login, register, forgot-password, reset-password) load with no console errors. It does not sign in, so it proves route protection only, not any signed-in behaviour.

`apps/web/app/(app)/running/actions.test.ts`: 9 tests of the `importGpx` server action with a mocked database client and mocked redirects (no real database): multi-file import, origin label, single-file redirect, name handling, duplicate skip, mixed good and bad files, save failure, file-count and size limits, unknown origin. A mutation check confirmed the duplicate test fails when the duplicate check is disabled.

`apps/web/app/(app)/chess/play/actions.test.ts`: 12 tests of the multiplayer chess server actions with a mocked database client (no real database): legal move recorded with the right ply, illegal move, wrong turn, non-participant, signed-out, finished/waiting/missing game, move after checkmate while status is still active, malformed ids and moves, database error messages, join/create/resign/draw input validation. Mutation checks: ignoring game-over and skipping the legality check each make a test fail.

`apps/web/app/(app)/edit-actions.test.ts`: 8 tests of `updateProject`, `updateGoal` and `updateEvent` with a mocked database (no real database): update payloads, revision guard, clearing blank fields, validation, conflict message, UTC conversion of event times.

`rls_task_recurrence.sql` (3 users plus anon): 16 results as expected. `lib/recurrence.test.ts` (9 tests) and `app/(app)/tasks/actions.test.ts` (7 tests, mocked database) cover the recurring-task logic.

`rls_task_attachments.sql` (3 users plus anon): 19 results as expected, covering the table and the `task-files` storage policies. `app/(app)/tasks/[id]/attachments.test.ts` (9 tests, mocked database and storage) covers validation, insert-then-upload order and soft delete.

`rls_chess_analyses.sql` (2 users plus anon): 13 results as expected. `app/(app)/chess/actions.test.ts` covers `saveAnalysis` with a mocked database.
