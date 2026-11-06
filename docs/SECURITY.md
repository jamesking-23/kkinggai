# Security

- Secrets are never committed; see `.env.example`. Service-role key is server-only.
- Row Level Security on every business table, workspace-scoped (Phase 2).
- AI provider calls happen server-side only (Phase 8).
- A GitHub token was exposed in chat during setup and must be revoked by the owner.

## Authentication (Phase 3)

- Sessions use `@supabase/ssr` cookies; middleware validates with `auth.getUser()` and redirects
  signed-out users to `/login`.
- Only the publishable key is used in the web app. Passwords: 10+ characters with a letter and a number.
- Auth callback only redirects to same-site relative paths. Password-reset requests never reveal
  whether an email has an account.
- Not yet verified against live Supabase Auth (see `DEVELOPMENT_STATUS.md`).
