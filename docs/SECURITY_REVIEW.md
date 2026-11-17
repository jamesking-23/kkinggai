# Security review (Phase 20, first pass, 2026-11-17)

This is a self-review by the developer (Claude) of what was checked and what was not. It is not an independent audit or a penetration test.

## Checked (evidence in this session)

| Check | Result |
| --- | --- |
| Row-level security on every public table (live query) | 50 tables, 0 without RLS, 0 without at least one policy |
| Service-role key in code | Not referenced in any source file. `.env.example` lists an empty `SUPABASE_SERVICE_ROLE_KEY=` placeholder only; the app uses the publishable key plus the signed-in user's session |
| Secrets committed | Pattern scan (OpenAI-style, GitHub tokens, Google keys, JWTs, `client_secret = "..."`) over tracked files found nothing. Only `.env.example` files are tracked |
| Public (client-visible) env vars | Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the Expo equivalents |
| Server-only env vars | `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are read only in server code; AI provider keys are read only in `@kkingg/ai` on the server (no key is currently set) |
| Per-feature cross-user tests | Live, rolled-back RLS tests for every module (see TESTING.md), each with an outsider and an anonymous user |
| Supabase security advisors | Only accepted warnings: workspace helper functions and the `mp_*` game RPCs are SECURITY DEFINER and executable by signed-in users on purpose; leaked-password protection is disabled |
| Outbound fetching (news feeds) | Guarded server-side: HTTPS only, private and loopback addresses blocked, with unit tests (mocked DNS and fetch) |
| Multiplayer chess | Writes only through SECURITY DEFINER RPCs that check participation, turn and ply; invite codes are 32 hex characters and are cleared on join |

## Known gaps and decisions for the owner

1. **Hard-delete policies exist on 13 early tables** (workspaces, workspace_members, tasks, goals, projects, events, milestones, task_completions, reminders, habits, habit_logs, idea_backlog, strava_connections). Later modules have no DELETE policy and use soft delete. Decide whether the early tables should move to soft delete too; I have not changed them.
2. **Leaked-password protection is off** (Supabase Auth dashboard setting; cannot be set from here).
3. **Public sign-up is still enabled.** For a private system, consider disabling it in the Supabase Auth settings once your account exists.
4. **Auth Site URL and redirect URLs** must be set to `https://kkingg-ai.vercel.app`.
5. **Revoke the GitHub token and the Strava secret/tokens that were pasted into the chat earlier**, then issue new ones. Neither was written to the repo or memory.
6. **Multiplayer chess does not enforce chess rules in the database** (cheating by direct API call is detected by clients, not prevented).
7. **No rate limiting** on server actions, sign-in, feed fetches or game creation (only a 20-open-games cap per user).
8. **Desktop installers are unsigned**, so Windows SmartScreen will warn.

## Not checked

- No signed-in browser session has exercised any page, so UI-level access control (module gating, redirects) is verified by code and build only.
- No dependency vulnerability audit was run in this pass.
- No review of Vercel project settings (preview protection, env scoping) beyond what was configured earlier.
- Mobile app and desktop shell have never run on a real device.
