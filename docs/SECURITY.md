# Security

- Secrets are never committed; see `.env.example`. Service-role key is server-only.
- Row Level Security on every business table, workspace-scoped (Phase 2).
- AI provider calls happen server-side only (Phase 8).
- A GitHub token was exposed in chat during setup and must be revoked by the owner.
