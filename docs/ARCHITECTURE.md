# Architecture

Modular monolith in a pnpm + Turborepo monorepo.

- `apps/web` — Next.js (implemented as a minimal shell; navigation comes from the module registry).
- `apps/mobile` (Expo) and `apps/desktop` (Tauri) — not started.
- `packages/module-registry` — module definitions, dependency checks, navigation derivation.
- `packages/design-tokens` — colours, spacing, radius shared across platforms.
- Backend: Supabase project `kkingg-ai` (`rlinlmnpzrlbprmcejdk`, eu-central-1). No schema applied yet.

Principles: workspace ownership and RLS on every business table; provider credentials server-side only;
structured database is the source of truth; modules are loosely coupled.
