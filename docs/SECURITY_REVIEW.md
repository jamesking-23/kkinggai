# Security review (Phase 20, first pass, 2026-11-17)

This is a self-review by the developer (Claude) of what was checked and what was not. It is not an independent audit or a penetration test.

## Checked (evidence in this session)

| Check                                                 | Result                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row-level security on every public table (live query) | 50 tables, 0 without RLS, 0 without at least one policy                                                                                                                               |
| Service-role key in code                              | Not referenced in any source file. `.env.example` lists an empty `SUPABASE_SERVICE_ROLE_KEY=` placeholder only; the app uses the publishable key plus the signed-in user's session    |
| Secrets committed                                     | Pattern scan (OpenAI-style, GitHub tokens, Google keys, JWTs, `client_secret = "..."`) over tracked files found nothing. Only `.env.example` files are tracked                        |
| Public (client-visible) env vars                      | Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the Expo equivalents                                                                                      |
| Server-only env vars                                  | The Strava variables are no longer used (Strava was removed); AI provider keys are read only in `@kkingg/ai` on the server (no key is currently set)                                  |
| Per-feature cross-user tests                          | Live, rolled-back RLS tests for every module (see TESTING.md), each with an outsider and an anonymous user                                                                            |
| Supabase security advisors                            | Only accepted warnings: workspace helper functions and the `mp_*` game RPCs are SECURITY DEFINER and executable by signed-in users on purpose; leaked-password protection is disabled |
| Outbound fetching (news feeds)                        | Guarded server-side: HTTPS only, private and loopback addresses blocked, with unit tests (mocked DNS and fetch)                                                                       |
| Multiplayer chess                                     | Writes only through SECURITY DEFINER RPCs that check participation, turn and ply; invite codes are 32 hex characters and are cleared on join                                          |

## Known gaps and decisions for the owner

1. **Hard-delete policies exist on 12 early tables** (workspaces, workspace_members, tasks, goals, projects, events, milestones, task_completions, reminders, habits, habit_logs, idea_backlog). Later modules have no DELETE policy and use soft delete. Decide whether the early tables should move to soft delete too; I have not changed them.
2. **Leaked-password protection is off** (Supabase Auth dashboard setting; cannot be set from here).
3. **Public sign-up is still enabled.** For a private system, consider disabling it in the Supabase Auth settings once your account exists.
4. **Auth Site URL and redirect URLs** must be set to `https://kkingg-ai.vercel.app`.
5. **Revoke the GitHub token and the Strava secret/tokens that were pasted (the Strava integration and its token table are gone, but the pasted values are still valid at Strava until revoked) into the chat earlier**, then issue new ones. Neither was written to the repo or memory.
6. **Multiplayer chess does not enforce chess rules in the database** (cheating by direct API call is detected by clients, not prevented).
7. **No rate limiting** on server actions, sign-in, feed fetches or game creation (only a 20-open-games cap per user).
8. **Desktop installers are unsigned**, so Windows SmartScreen will warn.

## Not checked

- No signed-in browser session has exercised any page, so UI-level access control (module gating, redirects) is verified by code and build only.
- No dependency vulnerability audit was run in this pass.
- No review of Vercel project settings (preview protection, env scoping) beyond what was configured earlier.
- Mobile app and desktop shell have never run on a real device.

## Dependency audit (2026-11-19)

`pnpm audit` found 6 production and 15 total advisories at the start of the session (PostCSS via Next, zod 3, minimatch via Expo, and a group in the Vitest test toolchain, 3 of them critical but only reachable when running Vitest's UI or dev server). Fixed by: zod 3 to 4.6.7 (one API change, `invalid_type_error` to `error`; amount messages re-checked by hand), pnpm overrides for `postcss` (>=8.5.23) and `minimatch` (>=11.0.1), and Vitest 2 to 4.1.12 with Vite 6.4.4. After the change `pnpm audit` reports no known vulnerabilities, and lint, typecheck, all tests (web 182, schemas 41) and the build pass. The audit only covers known advisories in the lockfile at that moment; rerun it before a release. The overrides force newer PostCSS and minimatch than their parents ask for; they build and pass the tests, but watch for breakage when Next or Expo is upgraded.

## Assistant cache and Gemini (3-tier pipeline)

- `response_cache` is shared between users, so it is locked down: RLS on with no policies, privileges revoked from `anon` and `authenticated`, RPCs executable by `service_role` only. Only server code holding `SUPABASE_SERVICE_ROLE_KEY` can read or write it; that key must live only in server environment variables (Vercel), never in the phone app, the browser or the repo.
- Only general, non-personal, non-time-sensitive questions are cached. Tier 3 (Gemini) receives the question and public app facts only, never a user's tasks, notes, runs or vault, and the conversation history it sees excludes replies produced by the built-in commands.
- Residual risks: a general question phrased with personal details but no trigger word could be cached; the 0.90 similarity can serve a near-miss answer; cached answers come from Gemini and can be wrong. Mitigations: bump the fact version or call `invalidateCacheByFact`, or delete rows from `response_cache`.
