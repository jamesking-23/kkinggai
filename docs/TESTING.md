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
