# Testing

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.

Automated tests: module registry (3), design tokens (1).

## Database / RLS

`backend/supabase/tests/rls_foundation.sql` creates two users inside a transaction, checks isolation,
then rolls back. It must be run manually (not in CI yet). Last run against `kkingg-ai`: 15 checks,
all as expected — cross-workspace reads and writes blocked, self-promotion to owner blocked, registry
read-only, audit logs append-only, anonymous reads return nothing.
The first run found a signup bug (duplicate owner membership), fixed in migration 2.

CI is defined in `.github/workflows/ci.yml` but has not been observed running on GitHub.
