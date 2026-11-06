# Testing

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.

Current automated tests: module registry (3), design tokens (1). Database/RLS tests begin in Phase 2.
CI is defined in `.github/workflows/ci.yml` but has not yet been observed running on GitHub.
