# Sports architecture

Sports in KKINGG AI are ordinary modules that share a few conventions. There is no generic "sport engine": each sport has its own
tables, pages and logic, because chess games and GPS runs have little in common. What is shared is the shape, so adding a sport is
repeatable. Chess and Running are the only sports that exist today.

## The pattern

1. **Module entry.** Register the module in `apps/web/lib/registry.ts` with `group: "sports"`, a nav item (order 70 or higher) and a row
   in `module_registry` via a migration (new workspaces get every active module automatically; the migration also enables it for existing
   workspaces). The Sports hub (`/sports`) lists every enabled module in the `sports` group, so no hub edit is needed.
2. **Hub figures.** Add an adapter to `apps/web/lib/sports.ts` (`SPORT_ADAPTERS`) that returns a few short lines of live figures. Adapters
   read through the user's own session, so row-level security still applies. A sport with no adapter still appears, without figures.
3. **Data.** Private, per-user tables following the existing conventions: `user_id default auth.uid()`, owner-only RLS policies,
   `revision` plus the `bump_revision` trigger for optimistic locking, `deleted_at` soft delete and no DELETE policy (an owner DELETE
   policy only where deleting is the point, like removing stored OAuth tokens), check constraints on every bounded field, and a partial
   unique index on `(user_id, source, external_id)` so re-importing is a no-op.
4. **Sources.** Each record has a `source` (manual, a file format, an external service). Imports parse and validate on the server, skip
   duplicates and report what was skipped. File formats used so far: PGN (chess), GPX (running). External services (Lichess, Chess.com,
   Strava, removed 2026-11-17) are called only from server code with an injectable `fetch` so they can be unit-tested with mocked responses.
5. **Logic.** Pure functions in `apps/web/lib/<sport>.ts` (parsing, statistics, scheduling) with unit tests; pages stay thin.
6. **Pages.** `/<sport>` dashboard plus detail pages and server actions, written like the existing ones (zod parse, `flash`, revision guard).
7. **Verification.** An RLS test in `backend/supabase/tests/rls_<sport>.sql` (owner, workspace admin, outsider, anonymous; no literal
   delete statements), the advisor check, lint, typecheck, unit tests and a production build before pushing.
8. **Honesty.** Record in `DEVELOPMENT_STATUS.md` what was written, what was tested and how (mocked, real, in a browser), and what is not
   built. Do not add placeholder sports or buttons that do nothing.

## Candidate future sports

Badminton (listed in the owner's interests) is the natural next one: matches, opponents, scores, and a training log. It is not built and
has no tables or pages. Nothing is shared with Chess or Running except the conventions above.
