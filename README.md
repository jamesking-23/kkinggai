# KKINGG AI

A private, modular personal operating system (web, Android, iOS, Windows). See `docs/PRODUCT_VISION.md`
and `docs/DEVELOPMENT_STATUS.md` for current state.

## Stack

pnpm + Turborepo monorepo, TypeScript, Next.js (web), Expo (mobile), Tauri (desktop),
Supabase (Postgres, Auth, Storage). Supabase project ref: `rlinlmnpzrlbprmcejdk` (eu-central-1).

## Commands

```bash
pnpm install
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

Copy `.env.example` to `.env.local`. Never commit secrets.
