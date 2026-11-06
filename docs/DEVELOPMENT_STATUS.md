# Development Status

## Current phase

Phase 3 (authentication) — code complete, live sign-in flow NOT yet verified end to end.

## Completed

- Phase 0 audit; Phase 1 foundation; Phase 2 backend (migrations applied, RLS tests passing).
- Phase 3 code: register, login, logout, forgot/reset password, auth callback, protected routes via
  middleware, profile and workspace loaded on the home page. Shared zod schemas in `@kkingg/schemas`.
  Unsafe redirect targets are rejected; forgot-password gives the same response for any email.
- Verified locally: lint, format, typecheck, 12 unit tests, `next build`. Against a running production
  build: `/` and `/tasks` redirect to `/login` when signed out, auth pages return 200, a bad callback
  redirects to `/login` with an error and ignores an unsafe `next`.

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

- Profile editing and account settings page, workspace switcher UI, account deletion workflow.
- `apps/mobile`, `apps/desktop`; storage buckets; productivity tables; Tailwind/shadcn (Phase 4).
- RLS tests are manual, not in CI. GitHub Actions not yet observed running.

## Exact next action

Owner tries sign-up/sign-in locally (`pnpm --filter @kkingg/web dev`) and reports any problem. Then
Phase 4: design system and application shell (Tailwind, shadcn/ui, sidebar, top bar, workspace switcher).
