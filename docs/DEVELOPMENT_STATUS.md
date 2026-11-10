# Development Status

## Current phase

Phase 6 (module registry and Idea Inbox) — built and deployed; migration 4 applied. Not yet exercised by a
signed-in user (sandbox cannot reach Supabase). Phase 5 gaps (edit forms, reminders UI, milestones, subtasks,
planning views) are still open.

Phase 4 (app shell and design system) — code complete. Phase 3 auth and the signed-in shell have NOT been
verified against live Supabase (the sandbox cannot reach it); please try them locally.

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

## Exact next action

Owner tries sign-up/sign-in and the shell locally (`pnpm --filter @kkingg/web dev`) and reports problems.
Next: Phase 11 chess slice 2 (Stockfish analysis, puzzles, Lichess/Chess.com import), then running. The owner has authorised applying migrations without asking; still run each RLS test and advisor check.

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
