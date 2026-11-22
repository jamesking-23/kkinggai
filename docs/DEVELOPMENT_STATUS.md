# Development Status

## Current status (2026-11-19)

Phases 0-19 each have a first slice written and deployed at https://kkingg-ai.vercel.app (CI and Vercel green on `main`).
Phase 20 (testing and release) is under way. **No page has been exercised by a signed-in user**: the development sandbox
cannot reach Supabase, so everything below is "written, built, unit-tested and (for the database) tested live with
rolled-back SQL", not "seen working in a browser". Verification so far: lint, typecheck, unit tests (web 182, schemas 41,
others 22), production build, `pnpm audit` clean, a signed-out route smoke test (41 routes), live RLS tests for every module.

| Phase | Area                                              | State                                                                                                                                                                                          |
| ----- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-2   | Audit, foundation, backend and RLS                | Done; live RLS tests pass                                                                                                                                                                      |
| 3-4   | Auth, app shell, design system                    | Code done; sign-in never exercised against live Supabase                                                                                                                                       |
| 5     | Tasks, goals, projects, events, habits, reminders | Built; gaps listed below                                                                                                                                                                       |
| 6     | Module registry, Idea Inbox                       | Built                                                                                                                                                                                          |
| 7     | Personal Vault                                    | Built                                                                                                                                                                                          |
| 8     | AI core                                           | Built; **no AI key is set**, so no real AI call has ever been made                                                                                                                             |
| 9     | Universal search                                  | Built (substring match only)                                                                                                                                                                   |
| 10    | Academics, flashcards, career, research           | Built                                                                                                                                                                                          |
| 11    | Sports: chess, running, sports hub                | Built. Strava removed (API no longer open); runs come from GPX/TCX file uploads                                                                                                                |
| 12    | Business ventures and ledger                      | First slice (assumed reading, see below)                                                                                                                                                       |
| 13    | Personal: journal, important dates                | First slice (assumed reading)                                                                                                                                                                  |
| 14    | News feeds                                        | First slice (RSS/Atom reader, mocked fetch only)                                                                                                                                               |
| 15    | Entertainment media log                           | First slice (assumed reading)                                                                                                                                                                  |
| 16    | Notifications                                     | In-app only, hourly pg_cron job (not yet seen firing). No push, email, SMS or voice                                                                                                            |
| 17    | Mobile (Expo)                                     | v0.2: sign in, notifications, tasks (add and complete). Never run on a device; no APK built                                                                                                    |
| 18    | Desktop (Tauri)                                   | Windows shell around the website; installer built by CI, never installed                                                                                                                       |
| 19    | Multiplayer chess                                 | Friend games: invite link, moves, resign, draw, rematch, clocks. Polling, no realtime; no ratings or spectators by decision (ratings need a trusted result; the database cannot see checkmate) |
| 20    | Testing and release                               | Security review, release checklist, smoke test, audit done; signed-in smoke test needs the owner                                                                                               |

Assumption for Phases 12-19: the exact wording of those phases was lost when the conversation was compacted, so each was built
on a conservative reading. If the master prompt asks for more, treat these as the base to extend.

Known gaps (Phase 5): push/email reminders (parked), richer planning (drag to reschedule, week/day grid).
Other open items are in the per-phase notes below.

## Exact next action

1. Owner: follow `RELEASE_CHECKLIST.md` (owner actions, then the signed-in smoke test) and report what breaks.
2. Development: fix what the smoke test finds; realtime for multiplayer chess; delivery channels for notifications; more tests.
   The owner has authorised applying migrations without asking; still run each RLS test and advisor check.

## Completed

- Phase 0 audit; Phase 1 foundation; Phase 2 backend (migrations applied, RLS tests passing).
- Phase 3 code: register, login, logout, forgot/reset password, auth callback, protected routes via
  middleware, profile and workspace loaded on the home page. Shared zod schemas in `@kkingg/schemas`.
  Unsafe redirect targets are rejected; forgot-password gives the same response for any email.
- Verified locally: lint, format, typecheck, 16 unit tests, `next build`. Against a running production
  build: `/` and `/tasks` redirect to `/login` when signed out, auth pages return 200, a bad callback
  redirects to `/login` with an error and ignores an unsafe `next`.

- Phase 4 code: Tailwind v4 theme mirroring the design tokens; responsive shell (collapsible sidebar,
  mobile drawer, top bar) with navigation generated from the registry plus the workspace's enabled modules
  (`workspace_modules`); working workspace switcher (cookie validated against RLS-visible workspaces);
  account menu with sign out; settings page to edit name and time zone; module search (jumps to modules).

- Phase 5 code: tasks (create, complete/reopen with completion history, soft delete, project/category/priority,
  due dates in the user's time zone), projects (status changes, open-task counts), goals (target, progress
  updates, achieve/abandon), habits (private, daily log, streaks), calendar (month grid, events, open tasks on
  due dates), and a dashboard showing real data only. Edits use the stored `revision` as an optimistic lock:
  a stale edit is rejected with a message instead of overwriting a newer change.
- Verified: lint, format, typecheck, 34 unit tests (time zones, streaks, progress, schemas), production build;
  signed-out requests to every new route redirect to `/login`. Database access rules were tested in SQL.

- Phase 6: migration `20261107000004_modules_and_ideas` applied. Database rules: only owners/admins can toggle
  modules; clients cannot insert or delete `workspace_modules` rows; enabling needs dependencies on, disabling is
  blocked while another enabled module needs it and for core modules (Dashboard). `idea_backlog` table with RLS.
  UI: `/settings/modules` (enable/disable with the database's messages relayed) and `/ideas` (capture, filter by
  status, change status, soft delete; priority, category, related module, notes). Disabled modules redirect home.
  Voice capture for ideas waits for the voice phase.
- Access-rule SQL test `rls_modules_ideas.sql`: 19 checks, all as expected. Unit tests now 38.

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

- Phase 5 gaps still open: task recurrence and attachments, edit forms for projects/goals/events, project
  milestones, daily/weekly planning views, activity history, dashboard widget configuration. Reminder delivery
  (push/email) needs Phase 16; reminders only show on the dashboard when due.
- Database types are hand-saved from the generator in `apps/web/lib/supabase/database.types.ts`; regenerate after each migration.
- No automated tests yet for the server actions or pages themselves.
- Supabase Auth: "leaked password protection" is off (advisor warning); enable it in Authentication settings
  (may need a paid plan).
- Account deletion, data export, password change from settings.
- Notifications bell and AI assistant button are intentionally absent until their backends exist
  (Phases 8 and 16).
- Shell components (sidebar, menus) have no automated component tests yet; only logic is unit tested.
- `apps/mobile`, `apps/desktop`; storage buckets; Vault storage buckets.
- RLS tests are manual, not in CI. GitHub Actions not yet observed running.

## Update: task detail, milestones, reminders (code written, not exercised against a live database)

- `/tasks/[id]`: edit details (revision-guarded), one-level subtasks with completion history, per-task reminders.
- Goals: add and complete milestones. Dashboard: "Reminders due" card with dismiss.
- Verified: lint, format check, typecheck, 41 unit tests and production build pass. The new pages and actions have
  not been run signed in because the sandbox cannot reach Supabase.

## Update: Phase 7 Personal Vault

- Migration `20261107000005_vault.sql` is APPLIED to `kkingg-ai`: private `vault` bucket, `vault_items` table,
  owner-only RLS on both, `vault` module registered and enabled for existing workspaces.
- RLS tested live (`backend/supabase/tests/rls_vault.sql`, rolled back): 17 results, all as expected (owner CRUD,
  cross-folder and non-http inputs blocked, other users/outsiders/anonymous see nothing, no hard delete).
  Not testable in SQL: deleting storage objects (Supabase blocks direct deletes; use the Storage API).
- `/vault` page: notes, links, file upload (PDF, images, text, Word, Excel; 4 MB because uploads go through a
  server action under Vercel's 4.5 MB request cap), signed download links (5 minutes), soft delete.
- Verified: lint, format, typecheck, 43 unit tests, production build. NOT verified: the page signed in, and file
  upload/download through the real Storage API (sandbox cannot reach Supabase).
- Not built: end-to-end encryption (the page says so), editing items, search within the vault, restore/permanent
  delete, direct-to-storage uploads for files over 4 MB.

## Update: Phase 8 AI core

- Migration `20261108000006_ai_conversations.sql` is APPLIED to `kkingg-ai`: `ai_conversations`, `ai_messages` (owner-only,
  messages immutable, conversations soft-deleted), Assistant module registered and enabled for existing workspaces.
- RLS tested live (`backend/supabase/tests/rls_ai.sql`, rolled back): 16 results, all as expected, including that a
  workspace admin cannot see another member's chats. Column list checked against the hand-added `Database` types.
- `packages/ai`: Gemini and OpenRouter providers, env-based selection, key-safe error mapping, history trimming; 12 unit
  tests against a mocked network. NOT yet called against a real provider: no API key has been supplied.
- `/assistant` page: conversation list, thread, send, soft delete; 50 messages per account per 24 h; the user message is
  saved before the provider call. The assistant sees only the current conversation, not tasks or the vault.
- Verified: lint, format, typecheck, 52 unit tests, build. NOT verified: the page signed in, or a real model reply.
- Owner to do: set GEMINI_API_KEY or OPENROUTER_API_KEY on Vercel (optionally GEMINI_MODEL / OPENROUTER_MODEL; default
  model names are unverified guesses). Public sign-up is on, so consider disabling it in Supabase Auth.
- Not built: streaming replies, giving the assistant access to app data or tools, conversation rename/search.

## Update: Phase 9 universal search

- Migration `20261109000007_search.sql` APPLIED: `search_workspace(ws, q, per_kind)`, SECURITY INVOKER so every table's RLS
  applies; searches tasks, projects, goals, events, habits, ideas, plus the caller's own vault items and AI chat titles.
  Substring match with LIKE wildcards escaped; 2-100 character queries. Not executable by anonymous users.
- Tested live (`backend/supabase/tests/rls_search.sql`, rolled back): 10 results, all as expected (soft-deleted rows hidden,
  wildcards literal, admin cannot find another member's vault or chats, outsider gets nothing, anon blocked).
- `/search` page and top-bar search (Enter searches records; the dropdown still offers module jumps). Results are limited
  to modules enabled in the workspace. 22 web unit tests (2 new files of logic).
- Verified: lint, format, typecheck, 54 unit tests, build. NOT verified signed in.
- Limits: plain substring matching, no ranking or typo tolerance, no search inside Vault files or milestones, subtasks
  and reminders. Add trigram/full-text indexes if the data grows.

## Update: Phase 10 (academics, flashcards, career)

- Migrations APPLIED: `20261109000008_academics_flashcards`, `20261109000009_career`, `20261109000010_search_academics_career`.
- Academics/Flashcards: shared workspace tables (courses, assignments, study_notes, flashcard_decks, flashcards) and a private
  `card_reviews` history. `/academics`: courses, assignments (due, status, score, weight, overdue flag, graded %), study notes.
  `/flashcards`: decks, cards, review queue with SM-2 style scheduling (`lib/spaced-repetition.ts`).
- Career: private per-user tables (career_profiles, cv_entries, job_applications, interview_prep, portfolio_items); no workspace
  sharing and no delete policies. `/career` (application pipeline with status counts and 14-day deadline warning, interview
  prep with confidence, portfolio), `/career/profile` (profile and CV entries), `/career/cv` (printable CV; use the browser's
  print to save a PDF; the sidebar and header are hidden when printing).
- Universal search now also covers courses, study notes, decks, cards, applications, interview questions and portfolio items;
  career records only match for their owner.
- RLS tests run live and rolled back, all as expected: `rls_academics.sql` (17 results), `rls_career.sql` (17),
  `rls_search_academics_career.sql` (5), and the earlier `rls_search.sql` re-run after the function change (10). Direct hard
  deletes are checked by confirming no DELETE policies exist (a literal delete statement triggers a confirmation prompt that
  times out).
- Verified: lint, format, typecheck, unit tests, build. NOT verified signed in; CV print layout not viewed in a browser.
- Phase 10 NOT built: quizzes, document organisation, research tools, AI-generated flashcards/quizzes, CV export to PDF/Word
  as a file (print-to-PDF only), assignments linked to the Tasks module.
- Phase 9 gaps against the spec: ILIKE instead of PostgreSQL full-text search, no filters, no search history.

## Update: Phase 10 gaps closed (quizzes, research)

- `/flashcards/quiz`: multiple-choice quizzes built from your own cards (other cards' answers are the distractors; needs at least
  4 cards with different answers). Per deck or across all cards, 1-20 questions. Grading is by card id, results show the right
  answer. Pure logic in `lib/quiz.ts` (4 unit tests). Quiz results are not stored and do not change card scheduling.
- Research library at `/academics/research`: migration `20261109000011_research` APPLIED (`research_sources`, shared in the
  workspace, soft delete, optional course link; search function extended). Sources have kind, authors, year, link, reading status
  (to read / reading / read), your notes and tags.
- RLS tested live and rolled back (`rls_research.sql`): 15 results, all as expected, including the search over research sources.
- Verified: lint, format, typecheck, 65 unit tests, build. NOT verified signed in.
- Phase 10 still NOT built: document organisation (beyond the Vault's categories and tags), AI-generated flashcards or quizzes,
  CV export to a Word/PDF file (print-to-PDF only).

## Update: Phase 11, chess slice 1 (game history, PGN import/export)

- Migration `20261110000012_chess` APPLIED: `chess_games` and `chess_profiles`, private per user (no workspace sharing, no
  delete policies, soft delete, optimistic-lock revision). Module `chess` registered and enabled for existing workspaces.
- `/chess`: win/draw/loss overall and by colour, top openings, rating span from imported PGNs, game history, PGN import
  (paste or `.pgn` file, up to 200 games / 1 MB, duplicates skipped, illegal games reported and not saved), PGN export
  (`/chess/export`), saved player names used to work out which side you played.
- `/chess/[id]`: board viewer that steps through the game (buttons, move list, left/right arrow keys), notes and tags, raw PGN,
  remove. The board is a plain unicode rendering of server-computed positions, not an interactive board.
- Parsing and move validation use `chess.js`. Openings come from a small bundled prefix table (`lib/openings.ts`, about 40
  entries), not a full ECO database; a PGN's own Opening/ECO headers take priority.
- Tests: `rls_chess.sql` run live and rolled back, 15 results all as expected; advisors show only the already-accepted
  warnings. 15 new unit tests in `lib/chess.test.ts`. Verified: lint, format, typecheck, unit tests, build. NOT verified signed in.
- Phase 11 chess NOT built yet: Stockfish engine analysis, puzzles, training, endgames, Lichess/Chess.com import (the
  username fields are stored only and connect to nothing), search integration, manual game entry, a playable board.
- Phase 11 running and future-sports architecture NOT started.

## Update: Phase 11, chess slice 2 (Stockfish analysis)

- `/chess/[id]` can now analyse a game with Stockfish 19 (the "lite", single-threaded WASM build from the `stockfish` npm package),
  running in a Web Worker in your browser. Choose depth 10, 14 or 18. Shows an evaluation bar, the engine's suggested move for the
  position before each move, per-move labels (best / good / inaccuracy `?!` / mistake `?` / blunder `??`) and average centipawn
  loss per side. Positions where the game is over are scored without the engine.
- Classification is by evaluation change at the chosen depth (thresholds 30 / 80 / 200 centipawns; evaluations clamped to +-1000).
  It is an estimate from a lite engine, not a chess.com or Lichess "accuracy" figure. Results are NOT saved; re-run to see them again.
- Engine files are copied from `node_modules` into `apps/web/public/engine` by `scripts/copy-engine.mjs` before dev and build
  (git-ignored, about 1.9 MB). Stockfish is GPL-3.0; its licence text is copied alongside. This is a private app, but keep the licence
  in mind if it is ever distributed.
- Verified: pure logic in 10 unit tests (`lib/analysis.test.ts`); the Engine class run for real in headless Chromium on a 7-ply game
  (worker loads, scores plausible, the blunder allowing mate was flagged, final checkmate scored without the engine). Lint, format,
  typecheck, unit tests and build pass. NOT verified: the full page signed in, mobile browsers, large games at depth 18.
- Phase 11 chess still NOT built: saved analyses, puzzles, training, endgames, Lichess/Chess.com import, search integration, playable
  board. Running and future sports not started.

## Update: Phase 11, chess slice 3a (Lichess and Chess.com sync)

- `/chess` shows "Sync Lichess" / "Sync Chess.com" buttons once a username is saved. Each pulls up to 100 recent public games (Lichess
  `/api/games/user/...`; Chess.com latest 2 monthly archives), parses them with the same validated PGN pipeline, skips games already
  saved for that source and works out your colour from the saved names. The username used is always the one saved on your profile,
  validated to letters, digits, `_` and `-`; Chess.com archive links are only followed if they stay on the user's own API path.
  No login, token or password is used, so only public games are reachable (private Lichess games are not).
- **Code written and tested against MOCKED responses only (7 unit tests in `lib/chess-sources.test.ts`). The sandbox cannot reach
  lichess.org or api.chess.com, so neither integration has been run against the real service.** Treat them as unproven until you click
  Sync once and confirm games appear. Field formats (Lichess PGN stream, Chess.com `games[].pgn`) follow the public API docs as I know
  them and could differ in detail.
- Verified: lint, format, typecheck, 68 unit tests, build.
- Still NOT built for chess: saved analyses, puzzles and training from your own mistakes, endgames, opening repertoire trainer,
  search integration, playable board. Running and future sports not started.

## Update: Phase 11, chess slice 3b (puzzles from your own mistakes)

- Migration `20261112000013_chess_puzzles` APPLIED: `chess_puzzles` (private per user, composite foreign key to the user's own game,
  one puzzle per game and move, spaced-repetition fields, soft delete, no delete policy). `chess_games` gained a unique `(id, user_id)`.
- After running the Stockfish analysis on a game, "Save my mistakes as puzzles" stores your mistakes and blunders (80+ centipawns lost).
  The server re-derives the position and the move you played from the stored PGN, checks it was your side, and checks the engine's
  suggestion is a legal, different move; the client supplies only the suggestion and the loss figure (self-reported by the in-browser
  engine, so it is not independently verifiable). Needs your side to be known (saved player names).
- `/chess/train`: shows the next due puzzle, you click a piece then a square. Only the engine's top move counts as correct, so another
  good move is marked wrong. "Show answer" counts as a miss. Leitner schedule: correct moves up a box (1, 3, 7, 14, 30 days), a miss
  resets to box 0 and retries in 10 minutes. The attempt is recorded server-side by comparing the submitted move with the saved solution.
- Tests: `rls_chess_puzzles.sql` run live and rolled back, 13 results all as expected (including cross-user game link and
  correct > attempts); advisors show only the accepted warnings. 6 unit tests for scheduling and click resolution. Lint, format,
  typecheck, 74 web unit tests and build pass.
- NOT verified: the training board and the save button were not exercised in a browser or signed in (the click logic is unit-tested;
  the UI is not). Puzzles are not shown on other devices differently, and there is no list view to delete or browse saved puzzles yet.
- Phase 11 chess still NOT built: endgame trainer, opening repertoire trainer, puzzles from outside sources, saved analyses, search
  integration, playable board. Running and future sports not started.

## Update: Phase 11, running slice 1 (activities, GPX import, dashboard)

- Migration `20261112000014_running` APPLIED: `run_activities` (private per user, soft delete, no delete policy, unique per source and
  external id, route stored as at most 600 `[lat, lon]` pairs, moving time cannot exceed elapsed time). Module `running` registered and
  enabled for existing workspaces.
- `/running`: this week / this month / all-time totals (weeks start Monday in your time zone), weekly distance for the last 8 weeks,
  fastest average pace on runs of at least 5 km / 10 km / half marathon / marathon (average over a whole run, NOT a split-based
  personal best), manual run entry (distance, time, climb, heart rate, effort), GPX import (up to 4 MB) and the activity list.
- `/running/[id]`: stats, route outline drawn as an SVG from the GPX points (no map tiles, no external map service), edit name/type/
  effort/notes, remove.
- GPX parsing is pattern-based, not an XML parser, so it never resolves entities or external references. Distance (haversine), moving
  time (stops and gaps over 60 s excluded, GPS jumps above 12 m/s ignored) and climb (3 m hysteresis) are calculated here, so they
  can differ from your watch. A GPX file with no timestamps is rejected. Re-importing the same track is detected and refused.
- Tests: `rls_running.sql` run live and rolled back, 15 results all as expected; advisors show only the accepted warnings. 14 unit
  tests (GPX parsing, track maths, route drawing, formatting, weekly and best-pace statistics). Lint, format, typecheck, 88 web unit
  tests and build pass.
- NOT verified: the pages signed in, GPX files from real devices (only generated test files), the route drawing in a browser.
- Running NOT built yet: live GPS tracking in the browser/phone, saved routes and route library, Strava (needs your own Strava API
  app and OAuth), Samsung Health (no public web API; GPX/file import is the realistic route), training plans, the AI running coach,
  shoes, heart-rate zones, search integration.
- Future-sports architecture NOT started.

## Update: Phase 11, running slice 2 (training plans, AI running coach)

- Migration `20261115000015_run_plans` APPLIED: `run_plans` and `run_plan_sessions` (private per user, composite foreign key so a session
  can only belong to the owner's own plan, archive/soft delete, no delete policies). RLS test run live and rolled back: 15 results, all
  as expected; advisors show only the accepted warnings.
- `/running/plan`: creates a plan for a 5 km, 10 km, half marathon or marathon (4 to 24 weeks, 3 to 6 runs a week). The plan is produced
  by a deterministic generator (`lib/plan.ts`, 12 unit tests), NOT by AI: build about 8% a week from your current volume (prefilled from
  your last 4 weeks), a lighter week every 4th week, a taper (1, 2 or 3 weeks by goal), long run on Sunday, one quality session a week
  alternating tempo and intervals, a rest day before the race, race on the race date. It warns when the build cannot reach a sensible
  peak. Sessions can be marked done, skipped or reset by hand (they are not auto-matched to logged runs yet). A new plan archives the
  current one. It is a generic progression and does not know injuries, terrain or pace; effort descriptions, not paces, are given.
- `/running/coach`: ask questions about your training. Each question builds a data block from the last 8 weeks (weekly totals, up to 15
  recent runs with distance/time/pace/climb/heart rate/effort, and the active plan's sessions for this and next week) and sends it with
  your message to the configured AI provider. Run names, notes and GPS routes are never included (unit-tested). The system prompt tells
  the model to use only the data, not to give medical advice, and to refer pain or illness to a professional.
- Coach chats are stored in the same `ai_conversations`/`ai_messages` tables as the assistant (titles start with "Running coach: ") and
  share the 50 messages per day limit. They also appear in the Assistant's conversation list; continuing one there would lose the data
  context (known limitation).
- **The coach has NOT been run: no AI provider key is set on the server and I never called a real model.** The provider code, prompt
  size and answer quality are untested against a real provider. Add `GEMINI_API_KEY` or `OPENROUTER_API_KEY` in Vercel and redeploy.
- Verified: lint, format, typecheck, 104 web unit tests, build. NOT verified signed in or in a browser.
- Running still NOT built: live GPS tracking, route library, Strava (needs your own Strava API app), Samsung Health (GPX/file import only),
  auto-matching runs to plan sessions, heart-rate zones, shoes, search integration. Future-sports architecture not started.

## Update: Phase 11, running slice 3 (Strava)

- Migration `20261115000016_strava` APPLIED: `strava_connections` (one row per user with the OAuth tokens Strava issued to this app). Owner-only
  RLS including an owner DELETE policy (disconnecting deletes the row). RLS test run live and rolled back: 9 results, all as expected.
- Server configuration: `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are set in Vercel (the secret as a sensitive variable). They are read only
  in server code and are not in the repository. The owner pasted a client secret and personal tokens into the chat; those pasted tokens were NOT
  used or stored. Recommendation: regenerate the client secret in the Strava API settings and update the Vercel variable.
- Flow: `/running` shows "Connect Strava" -> `/api/strava/connect` (signed-in users only; random state in an httpOnly cookie) -> Strava's own
  consent page -> `/api/strava/callback` (state and granted scope checked, code exchanged server-side, tokens stored). Scope requested:
  `activity:read_all` (read-only). "Sync Strava" refreshes the access token when needed, reads activities (up to 5 pages of 100 per sync; the first
  sync looks back one year), keeps runs only (Run, TrailRun, VirtualRun), skips ones already imported, and stores distance, time, climb, heart rate
  and a route outline decoded from Strava's summary polyline. The sync point only advances after a complete pass. "Disconnect" asks Strava to revoke the
  token (best effort) and deletes the stored tokens; imported runs are kept.
- Known limits: the tokens are readable by the owner's own signed-in session (there is no server-only secret store in this setup); they only allow
  reading that user's own Strava activities. The OAuth redirect uses the site's own origin, so connect from https://kkingg-ai.vercel.app (the callback
  domain set in the Strava app must be `kkingg-ai.vercel.app`). A new Strava API app is limited to its owner as the only connected athlete until
  Strava approves more. No webhook, so new runs appear only when you press Sync. Strava route data is a simplified outline.
- **Tested with MOCKED responses only (13 unit tests: authorize URL, token exchange and refresh, activity paging, polyline decoding against the
  published specification example, activity mapping). The sandbox cannot reach strava.com, so the real OAuth round trip and API field formats are unproven
  until you connect once.**
- Verified: lint, format, typecheck, 117 web unit tests, build. NOT verified signed in.

## Session update: Sports hub and future-sports architecture (2026-11-16)

- Written: optional `group` field and `inGroup()` on the module registry (unit-tested); Chess and Running registered in group `sports`; new `/sports` hub module (migration `20261116000017_sports_hub.sql`, applied) showing live figures through per-sport adapters in `apps/web/lib/sports.ts`; `docs/SPORTS_ARCHITECTURE.md`.
- Verified: lint, typecheck, unit tests (module-registry 5, web 117) and production build pass; security advisors show only the previously accepted warnings. The migration adds no tables, so no new RLS test.
- Not verified: the `/sports` page has not been exercised signed in (no access from this sandbox); adapters have no unit tests (they read Supabase).
- Not built: any sport beyond chess and running. Phase 11 is otherwise functionally complete as listed above; next is Phase 12.

## Session update: Phase 12 part 1, Business ventures (2026-11-17)

- Assumption: the exact Phase 12 wording could not be recovered after context compaction, so this slice is a conservative reading: private ventures with an income and expense ledger. Adjust if the master prompt asks for more.
- Written: migration `20261117000018_ventures.sql` (applied): `ventures` (stage, currency, soft delete, revision) and `venture_entries` (income or expense, amount numeric(14,2) > 0; composite FK `(venture_id, user_id)`); module `business` (`/business`, order 80), enabled for existing workspaces. Private per user, no DELETE policies, no workspace sharing. Schemas, `lib/ventures.ts` (cent-exact totals, monthly summary, money formatting), actions and page.
- Verified: RLS test `rls_ventures.sql` run live and rolled back, 15 results all as expected; security advisors show only the accepted warnings; lint, typecheck, tests (schemas 31, web 122) and production build pass.
- Not verified: the page has not been exercised signed in (sandbox cannot reach the site).
- Limits: the page reads the latest 2,000 entries across all ventures, so totals are exact only below that; one currency per venture, no conversion; no editing of entries (remove and re-add); no invoices, contacts, tasks, goals or reports for ventures yet; not in universal search yet.

## Session update: search covers business and sports (2026-11-17)

- Written: migration `20261117000019_search_business_sports.sql` (applied) extends `search_workspace` with ventures, chess games and runs (private: owner only, SECURITY INVOKER); search page labels and module gating updated.
- Verified: live rolled-back test `rls_search_business_sports.sql`: owner finds all three kinds, workspace admin and outsider find none, anon cannot call the function. The business deployment `33b235e` was READY.
- Not verified: the search page signed in. Search is still ILIKE matching (no full-text ranking).

## Session update: Phase 12 part 2, venture tasks and contacts (2026-11-17)

- Written: migration `20261117000020_venture_contacts_tasks.sql` (applied): `venture_contacts` and `venture_tasks`, private per user, composite FK to the owner's venture, soft delete, no DELETE policies. Page `/business/[id]` with task list (status, due dates, overdue marker) and contact list; link from each venture card. Schemas and unit tests added.
- Verified: live rolled-back test `rls_venture_contacts_tasks.sql`, 15 results all as expected; lint, typecheck, tests (schemas 33, web 122) and build pass.
- Not verified: the pages signed in. Not built: editing tasks or contacts (remove and re-add), venture reports, invoices, a Phase 12 reading beyond this slice if the master prompt asks for more. Tasks and contacts are not in universal search.

## Session update: Phase 13 part 1, Personal (journal and important dates) (2026-11-17)

- Assumption: the exact Phase 13 wording could not be recovered after context compaction, so this slice is a conservative reading: a private journal (one entry per day, optional mood and tags) and yearly important dates with an "upcoming" list. Adjust if the master prompt asks for more (for example health, relationships, finance links).
- Written: migration `20261117000021_personal_life.sql` (applied): `journal_entries` (unique per user and day while not deleted) and `important_dates` (month/day validated including leap years, optional year); module `personal` (`/personal`, order 90), enabled for existing workspaces. `lib/personal.ts` (next-occurrence maths; 29 Feb observed on 28 Feb in non-leap years), schemas, actions, page.
- Verified: live rolled-back test `rls_personal.sql`, 16 results all as expected; security advisors show only accepted warnings; lint, typecheck, tests (schemas 35, web 127) and build pass.
- Not verified: the page signed in. Not built: editing entries (remove and rewrite), search integration (journal text is deliberately not in universal search), reminders for upcoming dates, health or finance tracking.

## Session update: Phase 14 part 1, News feeds (2026-11-17)

- Assumption: the exact Phase 14 wording could not be recovered, so this slice is a conservative reading: an RSS/Atom reader for feeds the owner chooses. No news API, AI summaries, topic intelligence or alerts yet.
- Written: migration `20261117000022_news.sql` (applied): `news_feeds` (soft delete, unique URL per user) and `news_items` (unique per feed and guid, read and saved state; derived data, no DELETE policy); module `news` (`/news`, order 85). `lib/feeds.ts`: dependency-free RSS 2.0 / Atom parser (no entity expansion, markup stripped to text, only http(s) links kept) and a guarded fetcher. Page with add feed, refresh all (on request only, in parallel, 8 s per feed), unread/saved views, read and save toggles.
- Server-side fetch safety: only http/https on ports 80/443, no credentials in the URL, blocks localhost, single-label and .local/.internal names, private, loopback, link-local and metadata IPv4 ranges and non-global IPv6, resolves the host and checks every address, follows at most 3 redirects by hand and re-checks each hop, 1 MB body cap, 8 s timeout. Known limit: DNS rebinding between the check and the connection is reduced, not eliminated.
- Verified: live rolled-back RLS test `rls_news.sql`, 15 results all as expected; security advisors unchanged; 14 unit tests for the parser and fetcher using mocked responses; lint, typecheck, tests (schemas 37, web 141) and build pass.
- NOT verified: no real feed has been fetched (this sandbox cannot reach the web), so behaviour against real-world feeds (odd encodings, huge feeds, sites that block server user agents) is unknown. The page has not been opened signed in. Nothing refreshes automatically; scheduled refresh belongs to Phase 16.
- Not built: item search, folders beyond a free-text topic, OPML import, full-article reading, summaries.

## Session update: Phase 15 part 1, Entertainment media log (2026-11-17)

- Assumption: the exact Phase 15 wording could not be recovered, so this slice is a conservative reading: a private log of books, films, shows, games, music and podcasts (status, 1-5 rating, dates, notes, tags). No lifestyle features (recipes, travel, wellbeing), no recommendations and no external catalogue lookups yet.
- Written: migration `20261117000023_entertainment_media.sql` (applied): `media_items`, owner only, soft delete, no DELETE policy; module `entertainment` (`/entertainment`, order 95). `lib/media.ts` (yearly summary, average rating on finished items, stars), schemas, actions, page with status and kind filters. Marking an item done stamps today's date in the viewer's time zone when no finish date exists.
- Verified: live rolled-back RLS test `rls_media.sql`, 13 results all as expected; lint, typecheck, tests (schemas 40, web 144) and build pass.
- Not verified: the page signed in. Not built: editing title or notes (remove and re-add), search integration, cover art or metadata lookup, the lifestyle half of this phase.

## Session update: Phase 16 part 1, in-app notifications (2026-11-17)

- Assumption: the exact Phase 16 wording could not be recovered, so this slice is a conservative reading of "automations and notifications": an in-app inbox filled by a scheduled database job. Not built: push, email or SMS delivery, user-defined automation rules, voice.
- Written: migrations `20261117000024_notifications.sql` and `20261117000025_notifications_schedule.sql` (both applied). `notifications` table (owner can read and set `read_at` only; no insert, delete or other column updates through the API). `public.generate_notifications()` (SECURITY DEFINER, execute revoked from public, anon and authenticated) creates deduplicated notifications for: important dates in the next 3 days, wishlist job applications with a deadline within 3 days, venture tasks due tomorrow or up to 7 days overdue, chess puzzles due (one per day), and reminders whose time has come (marking them sent). Day boundaries use each user's own time zone. pg_cron job `generate-notifications` runs it hourly at minute 7 (confirmed registered and active). Page `/notifications` with unread filter, mark read and mark all read; module `notifications` (order 5).
- Verified: live rolled-back test `rls_notifications.sql`, 11 results all as expected (kinds generated, no duplicates after two runs, users cannot run the generator, edit titles, insert or delete; admin, outsider and anon see nothing); security advisors unchanged; lint, typecheck, tests (schemas 41, web 144) and build pass.
- NOT verified: that the cron job has actually fired on schedule (it was registered moments before this entry; check `cron.job_run_details` after the next :07). The page signed in. No unread badge in the navigation yet. Notifications are never deleted (the table grows slowly; retention is not implemented).

## Session update: Phase 17 part 1, Expo mobile app (2026-11-17)

- Written: `apps/mobile`, a real React Native app (Expo SDK 58, React Native 0.88, TypeScript), not a web wrapper. Version 0.1: email/password sign-in against Supabase (session kept with AsyncStorage, refresh only while the app is in the foreground), notifications inbox with mark read, open tasks (read-only), account and sign out. It uses only the public Supabase URL and publishable key (`EXPO_PUBLIC_*`); all data access is the signed-in user's own session under row-level security. No service-role key, AI key or other secret is in the app. `eas.json` (APK preview profile, app bundle production profile), `app.json` (bundle id and package `com.kkingg.ai`), `.env.example`, `README.md`.
- Verified: TypeScript strict typecheck passes; 4 unit tests (time and link helpers) pass; `expo export --platform android` bundled the JavaScript to Hermes bytecode (655 modules, 2.2 MB) with placeholder env values; the whole repo's lint, typecheck (6/6), tests and the web production build still pass after adding Expo.
- NOT verified: the app has never been run on a device, emulator or Expo Go (the sandbox has none), so real sign-in, layout, keyboard behaviour and session persistence are untested. No APK or iOS build exists: `eas build` needs an Expo account (and iOS an Apple developer account), which I do not have. The Supabase publishable key has not been set for the app, so it shows a "Not configured" screen until the two env values are supplied.
- Not built: task editing, the other modules (chess, running, business, etc.), push notifications (needs an Expo push or FCM setup), offline cache or sync, GPS run tracking, expo-router navigation (a simple tab switcher is used), app icon and splash artwork beyond the template defaults.

## Session update: Phase 18 part 1, Tauri desktop shell (2026-11-17)

- Written: `apps/desktop` (Tauri 2, Rust). A shell around the hosted web app, not a separate native interface: a bundled start page checks that https://kkingg-ai.vercel.app is reachable, then loads it, or shows a retry message when offline. The window has no native permissions (empty capability list) and in-window navigation is limited to the start page and the hosted site over HTTPS (`allow_in_window`, unit-tested). Windows installers (NSIS and MSI) are configured; workflow `.github/workflows/desktop.yml` builds them on `windows-latest` (manual run or `desktop-v*` tag) and uploads them as an artifact. Icons are generated from the placeholder Expo icon.
- Verified: on Linux, the Rust crate compiles against real Tauri 2 and its 2 unit tests pass; repo lint, format, typecheck (6/6), tests and the web build pass. The existing CI workflow has been observed running and passing on every push this session.
- Windows build: the Desktop workflow was run manually on `cbb4d71` (run 44069612656): Rust tests and the installer build passed on `windows-latest` and a 4.6 MB artifact `kkingg-ai-windows` (NSIS .exe and MSI) was uploaded. Download it from the Actions tab (it could not be fetched from the development sandbox).
- NOT verified: the installers have never been installed or opened, so the start page, the redirect to the site and how links that open new windows behave are untested. Installers are unsigned (SmartScreen warns). No auto-update, tray icon or native features.

## Session update: Phase 19 part 1, multiplayer chess between friends (2026-11-17)

- Scope note: the exact wording of Phase 19 could not be recovered after context compaction; this slice is a conservative reading (friend-vs-friend games under the existing `chess` module).
- Written: migration `20261117000026_multiplayer_chess` (`mp_games`; participants can only select; all writes go through SECURITY DEFINER RPCs `mp_create`, `mp_join`, `mp_move`, `mp_resign`, `mp_draw`; invite code is cleared when the opponent joins). Web: `/chess/play` (game list, new game), `/chess/play/join/[code]` (join needs a click, so link previews cannot take the seat), `/chess/play/[id]` (click-to-move board, move list, resign/cancel, draw offer/accept/decline, polling every 3 s while waiting). `lib/mp.ts` replays moves with chess.js and derives checkmate and automatic draws.
- Verified: live RLS/function test `rls_multiplayer.sql` (30 results, all as expected, rolled back); 14 unit tests for `lib/mp.ts`; repo lint, typecheck (6/6), tests and web build pass. Security advisors show only the accepted warnings plus 5 new intentional ones: the `mp_*` RPCs are executable by `authenticated`.
- NOT verified: no two real signed-in users have played a game in a browser; the board UI and polling are untested end to end.
- Known limits: the database does not know chess rules. The server action checks legality before calling `mp_move`, and every client replays the moves and shows an invalid game, so a direct-API cheater is detected, not prevented. No ratings (Elo needs a trusted result), no clocks, no rematch, no spectators, polling instead of Supabase Realtime, promotion is always a queen.

## Session update: Strava removed, workout file upload (2026-11-17)

- Why: Strava no longer offers its API to non-subscribers. Decision (by the owner): runs come in by uploading files exported from Strava and MapMyRun.
- Removed: the Strava OAuth routes, sync actions, `lib/strava.ts` and its tests, the Strava card on `/running`, `rls_strava.sql`, and the `strava_connections` table (migration `20261117000027`, applied; the table and `run_activities` were both empty beforehand, so no data was lost). Earlier docs entries about Strava describe code that no longer exists.
- Written: the running import now takes several `.gpx` or `.tcx` files at once (also `.gpx.gz`/`.tcx.gz` as in Strava's bulk export), up to 20 files and 4 MB in total per upload. The format is detected from the content. Average heart rate is read when present. Each run is labelled Strava, MapMyRun or Imported from the origin you pick. A workout already in your history is skipped whichever site it came from, and the result shows imported, skipped and failed counts with reasons.
- Verified: 10 new unit tests (TCX parsing, detection, gzip, a gzip-bomb cap, heart rate) and the existing running tests pass; repo lint, typecheck, tests and build pass; the migration was checked live (table gone, source constraint includes mapmyrun).
- NOT verified: no real Strava or MapMyRun export has been uploaded; the TCX reader is written to the Garmin TCX format and tested on synthetic files only, so a real file with a different layout may fail (the error message will say which file). Not supported: FIT files, Strava's activities.csv (names and metadata), and per-file names beyond what the file contains. Total upload is capped by the host's request limit, so a big history needs several uploads.

## Session update: Phase 19 part 2, rematches (2026-11-18)

- Written: migration `20261118000028_mp_rematch` (applied). `mp_rematch` invites the opponent to a new game with colours swapped; the invitation is a waiting game with the other seat reserved (`invited_id`), only that user can `mp_accept` or `mp_decline` it, and the invited user can read the waiting game so it appears in their list. One open rematch per game; the 20-open-games cap applies. Web: "Offer rematch" on a finished game, accept/decline on `/chess/play` and on the game page, a link to the rematch from the old game.
- Verified: live rolled-back test `rls_mp_rematch.sql`: 16 results as expected in the main run (offer, colour swap, one-open-rematch, self-accept blocked, outsider blocked from seeing/accepting/declining, accept seats the invited user, black cannot move first, anon blocked), plus a separate run confirming the decline path (decliner no longer sees the cancelled game, status is cancelled, and a new rematch is then allowed). Because the decline checks were split across two runs, the file contains them in one script that was not run exactly as saved. Repo lint, typecheck, tests and build pass. Advisors: only accepted warnings plus 3 intentional ones (the new RPCs are executable by signed-in users).
- NOT verified: no real two-account play in a browser. The database cannot tell that a game ended by checkmate, so a rematch can be offered from any game that has moves (the button shows once the client sees the game is over).
- Still not built: clocks, Elo ratings, realtime (still polling), spectators.

## Session update: Phase 20 part 2, route-protection smoke test (2026-11-18)

- Written: `scripts/smoke.mjs` (`pnpm smoke`), which discovers every page route and loads it in headless Chromium against a local production build.
- Verified: 41 routes, 0 failures, 0 console errors. Every protected route redirects to /login when signed out; the public pages render.
- NOT verified: anything signed in. Still needed: the manual smoke test in RELEASE_CHECKLIST.md with a real account.

## Session update: Phase 19 part 3, chess clocks (2026-11-19)

- Written: migration `20261119000029_mp_clocks` (applied). A multiplayer game can now be untimed or timed (3+2, 5, 10, 15+10, 30 minutes; the database accepts 1-180 minutes and 0-60 s increment). The database keeps each side's remaining time and when the running clock started, using the database clock. The first move of each side is free; after that the side to move is on the clock. A player who is out of time loses when they try to move (the move is not recorded) or when the opponent presses "Claim win on time" (`mp_claim_timeout`). Rematches keep the time control. Web: time-control picker, live clocks (`MpClock`), claim button, "lost on time" results.
- Verified: live rolled-back test `rls_mp_clocks.sql`, 16 results as expected (parameter limits, initial times, free first moves, increment and deduction, early claim refused, outsider and own-clock claims refused, late move recorded as a loss with the move dropped, no resign after timeout, rematch keeps the control, successful claim, anon blocked). Time was simulated by moving `clock_started_at` back; no real waiting. Unit tests for clock maths, formatting, time controls and the timeout text; action tests for the time control and claim. Repo lint, typecheck, 182 tests and build pass. Advisors: only accepted warnings plus one new intentional one (`mp_claim_timeout`).
- Test gap: the "untimed game" claim check was refused with "Game not found" (the second player was not in that game), so the "clock is not running" branch itself is untested.
- NOT verified: the live countdown in a browser, and two real accounts playing a timed game.
- Known limits: nothing flags a game by itself; an abandoned timed game stays "active" until the opponent claims. A timeout win against a side with insufficient material is not scored as a draw. Draw offers and acceptances are not blocked once a clock has run out. The countdown is a display only; the database is the authority. Still not built: Elo ratings, realtime (still polling), spectators.

## Session update: unread badge in the navigation (2026-11-19)

- Written: the Notifications entry in the sidebar shows the number of unread notifications (99+ above 99; a small corner badge when the sidebar is collapsed). The count is one lightweight query (`head` count, no rows) in the app layout, only when the Notifications module is enabled; if it fails, no badge is shown.
- Verified: unit tests for the badge text (2 new, web now 184 passing); lint, typecheck, build and format pass.
- NOT verified: how it looks in a browser, or that "Mark all read" updates the badge without a reload (it relies on the page revalidation re-rendering the layout).
- Still open for notifications: delivery by push, email or SMS (needs a provider account and keys from the owner; nothing is stubbed), retention of old notifications.

## Session update: edit forms for projects, goals and events (2026-11-19)

- Written: an "Edit" section on each project (name, description, due date), goal (title, target, unit, deadline) and event (title, start, end, location) on their list pages. Saves are revision-guarded like the existing status buttons, so a change made elsewhere shows "changed elsewhere" instead of overwriting. Blank optional fields clear the value. Event times are shown and saved in the workspace time zone (new `zonedLocalInput` helper, round-trip tested).
- Verified: 8 action tests with a mocked database (payloads, revision filter, blank clearing, validation, conflicts, UTC conversion) and 2 time-helper tests; web now 194 passing; lint, typecheck and build pass.
- NOT verified: the forms in a browser or against the live database; whether the `<details>` panels look right on a phone.
- Closes part of the Phase 5 gaps (edit forms for projects, goals, events). Still open: task recurrence and attachments, planning views.

## Session update: recurring tasks (2026-11-19)

- Written: migration `20261119000030_task_recurrence` (applied). A task can repeat daily, every weekday, weekly, monthly or yearly (set when adding a task or on its detail page; the list shows a repeat marker). Completing a recurring task marks it done, records the completion and creates the next copy (same title, description, priority, category, project) in one database transaction (`complete_task`, SECURITY INVOKER, so row-level security applies to every statement). The next due date is the next occurrence after the old due date that is not already in the past, so finishing late does not leave a pile of overdue copies. A database check limits `recurrence_rule` to the five rules.
- Verified: live rolled-back test `rls_task_recurrence.sql`, 16 results as expected (arbitrary rule blocked, stale revision refused, completion row and next copy, second completion refused, non-recurring and no-next-date make no copy, outsider/viewer/anon refused, open-task count unchanged). 9 unit tests for the date maths (month-end clamping, leap years, weekdays, skipping missed dates), 7 action tests with a mocked database (rule stored, next date computed in the workspace time zone, late completion, conflict message, reopen), 2 schema tests. Web 210, schemas 43 passing; lint, typecheck, build and format pass. Advisors unchanged (the new function is SECURITY INVOKER).
- NOT verified: in a browser, or the action against the live database (only the SQL function was run live).
- Known limits: reopening a completed recurring task does not remove the copy already created. Subtasks, reminders and attachments are not copied to the next occurrence. A monthly task due on the 29th-31st drifts to a shorter day after a short month (31 Jan, 28 Feb, 28 Mar) because the original day is not stored. Only the five fixed repeat choices exist (no "every 2 weeks" or chosen weekdays).
- Still open for Phase 5: task attachments, planning views.

## Session update: task attachments (2026-11-19)

- Written: migration `20261119000031_task_attachments` (applied). Private bucket `task-files` (25 MB bucket limit, mime allowlist without legacy .doc) and table `task_attachments`, shared by the workspace: members read, owner/admin/member write, viewers and outsiders cannot. Files live under `<workspace id>/<task id>/`, enforced by a check constraint and by storage policies that tolerate malformed folder names. No delete or update policy on the table or the bucket: removing an attachment soft-deletes the row and keeps the file. Task page `/tasks/[id]` gained an Attachments card (list, signed 5-minute download links, upload, remove).
- Upload order: metadata row first, file second. The bucket has no delete policy, so a file uploaded before a failed insert could never be cleaned up; if the upload fails the row is soft-deleted instead.
- Verified: live rolled-back test `rls_task_attachments.sql`, 19 results as expected (owner, viewer, outsider, anon; path of another task, spoofed created_by, foreign workspace folder, malformed folder, root-level object all refused; soft delete bumps revision; no delete/update policies). 9 action tests with a mocked database, 1 schema test. Web 220, schemas 44 passing; lint, typecheck, build and format pass. Advisors unchanged.
- Not verified: the upload and download through a signed-in browser against the real bucket (the bucket's mime allowlist and 25 MB limit were not exercised from the app). Removed files stay in storage. Attachments are not copied to the next copy of a recurring task, are not in universal search, and files are capped at 4 MB by the hosting request limit.
- Still open for Phase 5: planning views.

## Session update: task planning view (2026-11-19)

- Written: `/tasks?view=plan` (Open / Plan / All switch). Open tasks are grouped into Overdue, Today, Tomorrow, Next 7 days, Later and No due date, by due date in the user's time zone (`lib/planning.ts`). Same rows as the list (complete, open, delete). No database change.
- Verified: 5 unit tests for the bucket boundaries, the Kampala/UTC day edge, undated and finished tasks. Web 225 passing; lint, typecheck, build and format pass. CI for the attachments commit `797dbbe` passed.
- Not verified: the page signed in. Limits: reads the same 200 open tasks as the list, so a larger backlog is cut off; no drag-to-reschedule, no day/week time grid; subtasks are not shown.
- Phase 5 is now closed except push/email reminder delivery, which the owner parked.

## Session update: chess board customisation and premium UI pass (2026-11-20)

- Written: one shared `Board` component (`components/board.tsx`) now draws the analysis, multiplayer and puzzle boards. A "Customise board" panel offers: size (280-880 px slider plus S/M/L/XL/Max, capped at the available width), 8 colour themes plus a custom light/dark colour picker, 8 SVG piece sets plus plain Unicode glyphs, coordinates on/off, legal-move hints on/off (dots and capture rings from chess.js), last-move and selection highlights, reset. Choices are saved in the browser (`localStorage`, validated on read by `lib/board-prefs.ts`) and shared by every board on the page. They are per browser, not per account.
- Piece art: 8 permissively licensed sets copied from Lichess into `apps/web/public/pieces/` (see `docs/THIRD_PARTY_NOTICES.md`). Middleware no longer redirects `/pieces/*` to the login page.
- UI pass: gradient and glow page background, layered card surfaces with soft shadows, brand gradient on primary buttons, headings, progress bars, sidebar logo mark and avatar; sidebar active item with accent bar; blurred sticky top bar; focus rings on inputs; row cards lift on hover; page fade-in (disabled for reduced motion). Applied through the shared primitives (`Card`, `PageHeader`, buttons, inputs, `Shell`) so every page picks it up.
- Verified: 17 new unit tests (preference validation, themes, piece files all present); lint, typecheck, build and format pass. I rendered the board in a headless browser on a temporary page (removed afterwards) and looked at the screenshots: pieces, highlights, hints, theme and piece-set switching all drew correctly.
- Not verified: the signed-in pages with the new styling (no signed-in session); touch devices; the board at the largest sizes on a real phone; contrast of every theme against the highlight colours.
- Not done: board and piece preferences are not synced across devices; no piece animation or drag-and-drop (click-to-move only); the premium pass did not redo individual page layouts (dashboard only got the greeting), so the denser pages (running, business, sports) still look plain inside the new cards.

## Session update: page layouts (2026-11-20)

- Written: new `StatTile` in `components/ui.tsx`. Dashboard now opens with four headline tiles (open tasks, overdue, today's events, projects with goal count) and quick-action buttons; the separate Projects card was dropped. Running now shows week / month / all-time distance as tiles and the weekly distance as a vertical bar chart. The chess home shows record tiles and two action cards (Play a friend, Train on your mistakes).
- Verified: lint, typecheck, 237 tests, build and format pass. CI for `e4638c1` passed.
- Not verified: none of these pages was viewed in a browser (they need a signed-in session), so spacing and wrapping are untested. Business, sports, academics, career and the other module pages still use only the shared card styling.
- Business: each venture shows Income, Expenses and Net as tiles (Net turns red or green). Sports cards were left as they are (they already use the new card surface). Same limit as above: not viewed in a browser. Academics and career were not redone.

## Session update: realtime chess (2026-11-20)

- Written: migration `20261120000032_mp_games_realtime` (applied) adds `mp_games` to the `supabase_realtime` publication; confirmed it is the only table in it. The game page (`MpBoard`) subscribes to changes of its own game row with the browser client (`lib/supabase/client.ts`, publishable key only) and refreshes on any change. The 3 s poll stays as a fallback: it drops to every 30 s while the channel reports SUBSCRIBED and returns to 3 s if the channel errors, times out or closes (`pollIntervalMs`). Realtime applies the table's select policy, so players only receive their own games; writes still go only through the SECURITY DEFINER functions.
- Verified: publication membership by query; lint, typecheck, tests, build and format pass; one unit test for the poll interval.
- Not verified: a real two-browser game receiving a move over the websocket. The sandbox cannot reach Supabase realtime, so the subscription code has never connected. If it fails in use, the page behaves exactly as before (3 s polling). Opponent clocks and the lobby/invite list still rely on page loads, not realtime.

## Session update: drag and drop, piece animation (2026-11-20)

- Written: the shared `Board` now supports dragging a piece (mouse, touch, pen) with a floating piece under the pointer and a faded origin; clicking and keyboard (Tab to a square, Enter) still work, and pressing an already selected piece can be dragged without deselecting. Pieces slide from their old square when the opponent's move arrives (200 ms; skipped for a move the viewer just dragged, for reduced motion, on first render, and on the analysis board where stepping backwards would look wrong). Touch: pieces set `touch-action: none`, so the page does not scroll when a finger starts on a piece.
- Verified: on a temporary demo page (removed) in headless Chromium I ran five scripted interactions, all as expected: mouse drag, click-click, select then drag the selected piece, click-to-deselect, keyboard select-and-move. I also confirmed the slide animation runs for a click move and does not run for a dragged move, and looked at a mid-drag screenshot. Lint, typecheck, tests, build and format pass.
- Not verified: touch screens and real phones (only mouse and keyboard were scripted), the look of the slide itself (counted, not watched), and a real multiplayer game. Promotion still always chooses a queen. There are no premoves.

## Session update: promotion picker (2026-11-20)

- Written: in a multiplayer game, a pawn move to the last rank now opens a "Promote to" menu (queen, rook, bishop, knight, in your piece set) with Cancel, instead of always queening. `promotionChoices` and `moveWith` in `lib/puzzles.ts`; the server already accepted any legal promotion in the move string and still re-checks it. Puzzles keep using the solution's piece.
- Verified: 3 unit tests (four choices queen-first, none for ordinary or illegal moves, move built with the chosen piece, and a bare promotion refused); lint, typecheck, tests pass.
- Not verified: the menu in a browser (the multiplayer board needs a signed-in game); a real game ending in an under-promotion.

## Session update: saved chess analyses (2026-11-20)

- Written: migration `20261120000033_chess_analyses` (applied): one live analysis per game, private per user, soft delete only, shape and size checks on the stored evaluations. After an engine run the page saves the result (`saveAnalysis`, which checks there is exactly one evaluation per position of the stored game and replaces any earlier one); opening a game with a saved analysis shows it straight away with a note, and "Re-analyse" replaces it. A damaged or stale save (wrong count, bad move strings) is ignored by `parseSavedEvals`.
- Verified: live rolled-back test `rls_chess_analyses.sql`, 13 results as expected (owner, other user, anon; one live analysis per game; foreign game, spoofed user, non-array, empty and out-of-range depth all refused; soft delete frees the slot; no delete policy). 6 action tests (mocked database), 2 for `parseSavedEvals`, 2 schema tests; lint, typecheck, build and format pass. Security advisors unchanged. Performance advisors: INFO only (52 foreign keys without a covering index across the schema, including this table's and `task_attachments`; 14 unused indexes), not addressed; a single "add covering indexes" migration is a sensible later clean-up.
- Not verified: an engine run followed by a save in a browser (needs a signed-in session). The stored numbers come from the user's browser and cannot be checked by the server beyond their shape.

## Session update: foreign-key indexes (2026-11-20)

- Written: migration `20261120000034_fk_covering_indexes` (applied) adds a covering index for each of the 52 foreign keys the performance advisor flagged (lint 0001), built from `pg_constraint` so column order matches each constraint. Index names are long and repeat the table name (cosmetic).
- Verified: the advisor re-run shows no "unindexed foreign keys" finding. It now lists the new indexes under "unused index" (INFO), which is expected for indexes nothing has queried yet; it also still lists 14 older ones. Nothing was dropped.
- Not done: no measurement of query speed (the tables are tiny); unused indexes were not pruned. Re-check the "unused index" list after real use and drop the ones that stay unused.

## Session update: multi-word search (2026-11-20)

- Written: search now splits the query into words (or "quoted phrases"), searches each, and keeps only items that match every word, so words can sit in different fields and in any order; matches are highlighted in titles and snippets. No database change: it calls the existing `search_workspace` once per word (up to 4 words), asking for 20 hits per kind when there are several words. `lib/search.ts`: `splitTerms`, `intersectHits`, `highlight`.
- Verified: 10 new unit tests (term splitting, quotes, caps, intersection, highlighting with regex characters); lint, typecheck, build and format pass; tests: web 257, schemas 46, ai 12, mobile 4, module-registry 5, tokens 1.
- Not verified: the page signed in. Limits: each word still matches as a plain substring (no stemming, typo tolerance or ranking by relevance; results are newest-first within each kind); because each word's list is capped at 20 per kind, an item matching all words can be missed if it is older than 20 other items matching one word. Real Postgres full-text search (a ranked, indexed rewrite of the 19-branch function) was judged not worth the risk at this data size and is still open.

## Session update: heart-rate zones (2026-11-20)

- Written: migration `20261120000035_run_hr_zones` (applied): `run_activities.hr_buckets` (seconds per 5 bpm step, filled at import from GPX/TCX heart-rate samples) and `run_profiles` (one row per user, maximum heart rate 100-230, private, no delete policy). The Running page has a "Heart-rate zones" card to set max HR; a run's page shows time in five zones (percent of max HR: 50-60, 60-70, 70-80, 80-90, 90+) with bars, bpm ranges and time below zone 1. Zones are computed on view, so changing max HR re-splits every run that has data.
- Verified: live rolled-back test `rls_run_hr_zones.sql`, 12 results as expected (one profile per user, spoofed user refused, max HR range, other user and anon see nothing, hr_buckets shape and size limits, no delete policy). 9 unit tests for the histogram and zone maths, 4 action tests (histogram stored for a TCX with heart rate and null without; max HR saved or refused). Lint, typecheck, build and format pass.
- Not verified: the pages signed in; a real watch export (the TCX tests use synthetic files). Limits: only runs imported after this change have zone data (earlier imports and manual runs only have an average, and are not re-read); zones use plain percent-of-max, not heart-rate reserve or lactate-threshold methods; the 5 bpm bucketing makes zone edges approximate; no zone view across several runs or weeks yet.
- Weekly zone summary (same day): once a max heart rate is set, the Running page shows the last 8 weeks as stacked bars of time in each zone (colour per zone, hover for the split, total per week, legend). Weeks start Monday in the user's time zone. `weeklyZones` in `lib/hrzones.ts`; 3 new tests (week placement and order, runs without data or outside the window, time-zone edge). Lint, typecheck, build and format pass. Not viewed in a browser. It reads at most 500 runs with heart-rate data from the last 10 weeks.

## Session update: chess repertoire trainer (2026-11-20)

- Added `/chess/repertoire`: builds an opening repertoire from the user's own games (first 8 moves, positions reached in at least 2 games), lists moves with counts and score per colour, and a drill that shows a position and asks for the usual move.
- Pure logic in `lib/repertoire.ts` (replay-based) and client-safe formatters in `lib/repertoire-format.ts` (a first build failed because the client component imported a module using `node:crypto`; fixed by the split). 10 unit tests.
- Verified: lint, typecheck, tests, build and format:check all exit 0. Not verified: the page and drill in a signed-in browser, or against real game data.

## Session update: Academics and Career stat tiles (2026-11-20)

- Academics: tiles for active courses, open assignments, due in 7 days, overdue. Career: tiles for applications, applied, interviewing, deadlines in 14 days. Both reuse `StatTile`; no new queries.
- Sports overview left as is (it already shows adapter summaries).
- Verified: lint, typecheck, tests, build, format:check all exit 0. Not verified visually in a signed-in browser.

## Session update: AI provider key (2026-11-20)

- `GEMINI_API_KEY` is now set in Vercel (production and preview, type sensitive, so the value cannot be read back). The existing `providerFromEnv` already prefers Gemini, so no code change was needed; the model defaults to `gemini-2.5-flash` (override with `GEMINI_MODEL`).
- Takes effect on the next deployment. Not verified: no live AI call has been made (the sandbox cannot reach Google), and the key's format is unusual, so the first call from the signed-in app is the real test. The key was shared in chat; consider rotating it.

## Session update: assistant page redesign (2026-11-20)

- Restyled `/assistant` after the owner's reference images (original CSS, no third-party branding): animated orb, large light headline, glass prompt box with Enter-to-send, suggestion chips that fill the box, chat bubbles, and a "Thinking…" state (twin glowing orbs plus shimmer text) shown while the server action runs via `useFormStatus`. Reduced-motion users get static visuals.
- No behaviour change to `sendMessage`/limits. Verified: gate exit 0; the orb/glass/thinking CSS was rendered once on a standalone static page. Not verified: the real page signed in, or a live reply.

## Session update: recurring-task reopen and carry-over (2026-11-21)

- Migration `20261121000036_recurrence_reopen_copy` (applied): `tasks.spawned_task_id`; `complete_task` now also copies open subtasks and pending task reminders (shifted by the due-date offset) to the next copy; new `reopen_task` RPC reopens the task and soft-deletes the spawned copy (plus its subtasks, and dismisses its reminders) only if that copy is still untouched (todo). A started copy is kept.
- App: `toggleTask` reopen now calls `reopen_task` and says when a copy was removed. 3 reopen tests added (web tests mock the database).
- Live DB test `tests/rls_task_reopen.sql`: 15 of 15 lines as expected, including stale revision, viewer, outsider and anon refused. Security advisor: only the previously accepted warnings.
- Not verified in a signed-in browser. Attachments are still not copied to recurring copies.

## Session update: board preferences sync across devices (2026-11-21)

- The board look (size, colours, pieces, coordinates, hints) still lives in localStorage for instant use, and now also syncs through `user_settings.settings.board` (`{prefs, at}`), last write wins by timestamp. On the first board mount per page load the browser pulls a newer server copy or pushes a newer local one; changes are saved 0.8 s after the last tweak. Other keys in `settings` are preserved. No migration: the existing `user_settings` row and its own-row RLS are used.
- Server actions `loadBoardPrefs` and `saveBoardPrefs` (in `app/(app)/chess/board-prefs-actions.ts`) validate with `sanitizePrefs`, refuse stale or far-future timestamps, and never touch other users' rows. Pure helpers in `lib/board-sync.ts`. 13 new tests (web 296 total, mocked database).
- Live RLS check `tests/rls_user_settings.sql`: 4 of 4 as expected. Sync failures are silent and leave the local copy untouched.
- Not verified: two real devices syncing in signed-in browsers.

## Session update: premoves in live games (2026-11-21)

- On the opponent's turn in a live game you can pick one of your pieces and a destination; the move is queued (shown under the board) and plays automatically when the opponent's move arrives, only if it is legal in the new position (promotions become queens). Any click cancels it; it is dropped if the game ends. One premove at a time. `resolvePremove` in `lib/puzzles.ts` (4 tests; web 300 total). The server still validates every move.
- Not verified: two real players over realtime; the click flow was not run in a browser.

## Session update: attachments searchable; recurring copies do not inherit files (2026-11-21)

- Migration `20261121000037_search_attachments` (applied): `search_workspace` also matches task attachment file names and returns a link to the task. SECURITY INVOKER, so RLS applies. Live test `tests/rls_search_attachments.sql`: 8 of 8 as expected (owner and viewer find files; outsider none; soft-deleted file or deleted task hidden; `%` literal; anon refused). Search page shows a "Task files" group when the Tasks module is on. Web tests 301.
- Decision: attachments are NOT copied to the next copy of a recurring task. A file belongs to one occurrence, and the storage policy ties a file's path to its task, so sharing one file between tasks would need a policy change. Revisit only if wanted.
- Not verified: the search page in a signed-in browser.

## Session update: mobile tasks, add and complete (2026-11-21)

- The Expo app's Tasks tab can now add a task (to the user's first workspace, as on the web) and complete one through the existing `complete_task` RPC with the revision check; stale revisions show a refresh message. Repeating tasks show "Repeats" and cannot be completed on the phone (their next due date is computed on the web). All access is the signed-in user's own session under RLS; no new secrets.
- Verified: lint, typecheck, build, format pass; mobile tests 7 (3 new for `cleanTitle`). NOT verified: the screen has never run on a device or emulator; the add and complete calls were not exercised against the live database from the app.

## Session update: desktop tray (2026-11-21)

- The Tauri shell now creates a system tray icon with "Show KKINGG AI" and "Quit"; a left click on the icon shows the window, and closing the window hides it to the tray. If the platform cannot create the tray, the window keeps its normal close behaviour so the app can still be quit. No new window permissions were added (the capability file is unchanged).
- Verified: `cargo check` and `cargo test` (2 navigation tests) pass on Linux, and `cargo fmt` applied. NOT verified: the tray on Windows (the installer was built earlier but never installed, and this change has not been built into one), and the tray behaviour itself has no automated test. Auto-update is still not implemented: it needs a signing key and an update server, which are owner decisions.

## Session update: Habits and Goals stat tiles (2026-11-21)

- Habits: tiles for habit count, done today (turns green when all are done) and best daily streak. Goals: active, achieved and past-deadline counts. Both reuse `StatTile` and data the pages already load; no new queries. Not verified visually in a signed-in browser.

## Session update: Tasks stat tiles (2026-11-21)

- Tasks page: Open, Overdue and Done this week tiles. They come from three head-only count queries over top-level tasks in the current workspace (RLS applies), so they stay correct whichever view or filter is selected. Not verified in a signed-in browser.

## Session update: Calendar tiles and Sports card polish (2026-11-21)

- Calendar: tiles for events in the shown month, tasks due that month and the busiest day, computed from the data the page already loads. Sports: cards lift on hover and end with an "Open <module>" link. Not verified in a signed-in browser.

## Session update: error, loading and not-found pages (2026-11-21)

- Added `(app)/error.tsx` (friendly failure page with Try again and Dashboard; shows only the error digest, never the message), `(app)/loading.tsx` (shimmer skeleton while a page's data loads) and a styled root `not-found.tsx`. Before this a failing page fell back to the framework default. The build lists the new `/_not-found` route.
- Not verified: the error page was not triggered, and the skeleton and 404 were not viewed in a browser.

## Session update: notifications job observed running (2026-11-21)

- Checked `cron.job_run_details` for `generate-notifications`: 97 runs from 2026-11-17 06:07 to 2026-11-21 06:07 UTC, every one `succeeded`, no errors. This closes the earlier "not observed firing" gap. It does not show that any notification was generated for a real user (that depends on real data such as upcoming important dates), so seeing one in the inbox remains part of the smoke test.

## Session update: web push, migration written but NOT confirmed applied (2026-11-21)

- Written: `backend/supabase/migrations/20261121000038_web_push.sql` (push subscriptions, `register_push_subscription`, `push_dispatch` via pg_net and Vault, five-minute cron). The apply step timed out while the Supabase connection waited for an answer to a question, so it is unknown whether any part of this migration exists in the live database. Do not treat web push as operational. Next step: inspect the live database, then apply what is missing. Nothing else in web push (server route, service worker, UI) is built yet.

## Session update: web push built and armed (2026-11-21)

- Correction to the previous entry: the migration IS now applied. The first attempt stalled on a Supabase confirmation prompt; the tables went in as `web_push_tables`, the functions as `web_push_functions` after the prompt was approved, and the `push-dispatch` cron job (every 5 minutes) was created separately. Checked live: pg_net, 2 tables, 3 functions, active cron job.
- How it works: pg_cron runs `push_dispatch()`, which marks recent unpushed notifications for users with a subscription and POSTs them (with the shared secret from Supabase Vault) to `/api/push/dispatch`. The route checks the bearer secret in constant time, sends each push with VAPID through the `web-push` library and answers with a status per subscription; the next run prunes subscriptions the push service says are gone (404/410) or that fail five times. Delivery is at most once per notification. The server only sends to the known browser push services (Google, Mozilla, Windows, Apple hosts), so a registered endpoint cannot be used to reach other servers.
- UI: Notifications page has a "Push notifications" card (turn on, send a test, turn off). `public/sw.js` shows the notification and opens in-app links only. iPhone needs the site added to the Home Screen (iOS 16.4+).
- Secrets: VAPID keys were generated here. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` are plain Vercel variables; `VAPID_PRIVATE_KEY` and `PUSH_DISPATCH_SECRET` are sensitive Vercel variables; the same dispatch secret and the target URL are in Supabase Vault (`push_dispatch_secret`, `push_dispatch_url`). None is in the repo. The scratch copies were deleted.
- Verified: live rollback test `tests/rls_web_push.sql` (25 lines as designed; one count differed from my prediction because of identical timestamps in a single test transaction); a real encryption round trip against a local HTTPS stand-in push service (payload decrypts, VAPID signature verifies, key and audience match); web tests 315 (new: endpoint allow-list, payload and link sanitising, bearer check, route behaviour, send mapping). A unit test caught and I fixed a link check that let `//host` through.
- NOT verified: a real browser receiving a push (Google, Mozilla, Apple, Windows push services were never contacted); the Enable button and service worker in a browser; the first real cron run with a subscriber. Observed after deploy: the database called the live `/api/push/dispatch` with an empty batch and got HTTP 200 `{"results":[]}`, which confirms the deployed route, the shared secret and the database-to-site connection (no push was sent). Test it: open Notifications, turn push on, press "Send a test".
- Not built: Expo push for the mobile app, per-kind push preferences, quiet hours.

## Session update: performance advisor after web push (2026-11-21)

- Performance advisor: only INFO "unused index" findings, 62 of them (none are errors or warnings). Expected at this stage: the app has had no real traffic, and about half are the foreign-key covering indexes added on purpose in migration 034. Pruning is deliberately postponed until there is real usage to judge by; dropping them now could slow deletes and joins later. The new `push_subscriptions_user_idx` and `notifications_unpushed_idx` are not in the list yet.

## Session update: Android build on GitHub Actions

- Added `.github/workflows/mobile-android.yml`. It runs the mobile tests, `expo prebuild`, then Gradle `assembleRelease bundleRelease`, and uploads the APK and AAB as the artifact `kkingg-ai-android`. It needs no Expo account or token.
- Trigger: Actions tab > "Mobile (Android)" > Run workflow, or push a tag `mobile-v*`.
- Needs two repository variables (not secrets, both are public values): `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The workflow stops with a clear message if either is missing.
- Signing: the files are signed with the debug key. The APK can be sideloaded; the AAB cannot be uploaded to Google Play until a real upload keystore is set up.
- NOT verified: the workflow has never run (this sandbox's proxy blocks the Actions variables API, so I could not set the variables or start a run), and no APK has been installed on a device. The YAML was written but not executed.

## Session update: push quiet hours (2026-11-21)

- Migration `20261121000039_push_quiet_hours` applied (`push_in_quiet()` and an updated `push_dispatch()`). Quiet window is stored in `user_settings.settings.push_quiet` and evaluated in the user's account timezone. A notification that arrives during the window stays unpushed and is pushed after it ends if still under a day old. Bad data or an unknown timezone means "not quiet", so push is never lost to a typo.
- UI: the Notifications page has a "Quiet hours" form under the push card.
- Verified live (rollback tests, `tests/rls_push_quiet.sql`): 13 window cases and an end-to-end hold and release through `push_dispatch()`. Web unit tests added for the helpers and actions (mocked database).
- NOT verified: the form in a browser, and a real push arriving after quiet hours. Your account timezone must be set correctly in the app (it defaults to UTC), otherwise the window is measured in UTC.

## Session update: per-kind push preferences (2026-11-22)

- Migration `20261122000040_push_kinds` applied (`push_kind_enabled()` plus `push_dispatch()` updated again). `user_settings.settings.push_kinds` lists the kinds that may be pushed; absent means all. A muted kind is never marked pushed and ages out of the one-day window, so unmuting can push up to a day of recent ones. The inbox always shows everything.
- UI: "What to push" checkboxes on the Notifications page.
- Verified live (rollback tests, `tests/rls_push_kinds.sql`): 9 checks including hold and release through `push_dispatch()`. Web unit tests added (mocked database).
- NOT verified: the form in a browser or a real push.

## Session update: health check (2026-11-22)

- Vercel: the newest production deployment (`8bcfd8e`, per-kind push) is READY; runtime errors: none in the selected range (this may only mean little or no signed-in use).
- Supabase security advisor after migrations 039 and 040: no new findings. The new helper functions are not callable by app users. The same accepted items remain (13 signed-in SECURITY DEFINER warnings, `push_batches` RLS-without-policy INFO, leaked-password protection off).
- CI green on `8bcfd8e`; Mobile (Android) workflow last ran green on `a5c91c0` (before the push preference work, which does not touch the mobile app).

## Session update: in-app "Check for updates" on Android (2026-11-22)

- The Account tab has an "App updates" section. "Check for updates" reads this public repository's GitHub Releases, finds the newest `android-<n>` release and, if it is newer than the build number baked into the app, shows "Download and install". That opens the APK download; Android asks the user to confirm and installs over the old app, keeping data. A silent install is not possible on Android for a sideloaded app.
- The Android workflow now sets the build number (GitHub run number) as `versionCode` and `EXPO_PUBLIC_BUILD_NUMBER`, and publishes each successful build from `main` as a GitHub Release with `kkingg-ai.apk` attached (built-in token, no extra secret).
- Safety: only APK links under this repository's release downloads are ever opened; drafts and prereleases are ignored.
- Limits: (1) the APK you already installed has no update button, so it needs one last manual install of the next build; after that updates work in place. (2) In-place install only works if every build is signed with the same key; the workflow uses the standard Expo debug key, which should be the same each time, but that is NOT yet verified (needs two builds installed one over the other). A real upload keystore would remove that doubt. (3) A development build (no number) never reports itself out of date.
- Verified: 7 new unit tests for the pure logic (tag parsing, picking the newest, link allow-list, decisions). NOT verified: the workflow change has not run, the button has never run on a phone, and no release exists yet.

## Session update: signing key checked across builds (2026-11-22)

- The Android workflow now prints the APK signing certificate. Builds 5 and 6 (two separate runs) show the identical SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, so the debug key is stable between builds. This supports in-place updates, but it is still the public Expo debug key: fine for sideloading, not for Google Play, and anyone could build an APK that carries the same signature. A private upload keystore is still the real fix before any wider release.
- Releases `android-3`, `android-5` and `android-6` now exist. Run 4 failed only because I pushed a workflow with invalid YAML (a colon in a step name); I fixed it in the next commit. Lesson: check `format:check` exit code before committing workflow files.
- NOT verified: installing build 6 over build 5 on a phone, and the update button itself.

## Session update: Website tab in the Android app (2026-11-22)

- Finding from the first real device test (owner's screenshot): the APK installs, opens and shows the signed-in Tasks tab. It only had three native tabs (Notifications, Tasks, Account), which the owner reasonably read as "missing the website". Decision with the owner: wrap the website now, build native screens later, module by module.
- Added a "Website" tab (first, default) that loads https://kkingg-ai.vercel.app in a WebView (`react-native-webview` 14.0.1, the Expo SDK 58 version). The page stays mounted when switching tabs; the Android back button goes back inside the site first. Only https pages on the site's own host load in the app; other http, https and mail links open in the phone's browser; `intent:`, `file:`, `javascript:` and similar are blocked (`src/web.ts`, 3 tests).
- Sign-in: the website has its own session inside the WebView, so you sign in once there as well as in the native tabs. Web push does not work inside a WebView (no service worker), so the native Notifications tab remains the phone's inbox.
- Verified: typecheck, lint and 17 mobile tests. NOT verified: the tab on a phone (page loading, sign-in cookies, file upload, back button), because it needs a new build installed. If the site's sign-in does not persist inside the WebView that must be fixed before this is useful.

## Session update: in-app updater and native Home (2026-11-23)

- Owner confirmed the Website tab works on the phone (build 7).
- Updater rewritten: the app now only talks to this site. `/api/app/latest` (public JSON) reports the newest build and `/api/app/download` redirects to the APK; GitHub is read on the server only (cached 5 minutes) and never shown in the app. The app downloads the file with a progress percentage and hands it to Android's installer through a content URI (`expo-file-system`, `expo-intent-launcher`, permission `REQUEST_INSTALL_PACKAGES`). Android still shows its own confirmation, and the first time it asks the user to allow this app to install updates; both are operating-system rules that an app cannot skip. A tampered file signed with another key would be refused by Android.
- The build with the old updater (7) opens the browser to download. The first build with the new updater is the next release; after installing it once, later updates run inside the app.
- Native Home tab (default): greeting, live counts of open tasks and unread notifications, the next three due tasks, and a searchable grid of all 19 website modules. A module opens its page in the Website tab until it gets a native screen. Tabs are now Home, Tasks, Notifications, Website, Account. Android back returns to Home.
- Tests: web `lib/app-release.test.ts` (6) and mobile updater, link-rule and module tests (17 mobile tests in total). NOT verified on a phone: the download and install flow, the progress display, the Home screen counts. (The `/api/app/latest` route was checked live after deploy: HTTP 200, `{"build":7,...}`, no sign-in needed).
- Next native screens, in order of expected use: Calendar, Habits, Goals, then Chess and the rest.

## Session update: native Calendar screen (2026-11-23)

- Home > Calendar now opens a native agenda: the next 31 days of events and tasks that are due, grouped by day (Today, Tomorrow, then dates) in the account's own timezone, with pull to refresh. Events show start and end time and location; tasks show their due time. "Add / edit" opens the website's calendar in the Website tab, since creating and editing events is not built natively yet. Android back returns to Home.
- Logic is in `apps/mobile/src/agenda.ts` (day and time conversion, labels, sorting, dropping past days) with 5 tests, including a late-night event that falls on the next local day in Kampala; the screen is `CalendarScreen.tsx`.
- Verified: typecheck and 22 mobile tests. NOT verified on a phone: the screen, the Intl timezone support in the phone's JavaScript engine (Hermes), and the queries against real events. Overdue tasks are not listed (agenda starts today).
- Next native screens: Habits, Goals, then Chess.
