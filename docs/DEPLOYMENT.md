# Deployment

Environment variables are listed in `.env.example`. Public values are safe for clients; everything else is server-only.

## Web (Vercel)

Vercel project `kkingg-ai` (team `kkingg`), linked to `jamesking-23/kkinggai`, root directory `apps/web`, framework Next.js.
Every push to `main` deploys. Production URL: https://kkingg-ai.vercel.app (latest deployments reach READY; not yet
exercised by a signed-in user). Variables on the project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
(public by design). Not set: `GEMINI_API_KEY` or `OPENROUTER_API_KEY` (the AI features need one), and the old
`STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` should be removed (Strava was removed from the app).

In Supabase, Authentication, URL Configuration: set the Site URL to the production URL and add `<production URL>/auth/callback`
to the redirect URLs, or email links will not work.

## Backend (Supabase)

Project `kkingg-ai`, ref `rlinlmnpzrlbprmcejdk`. Migrations are in `backend/supabase/migrations/` and have all been applied;
live RLS tests are in `backend/supabase/tests/` (run manually, rolled back). The hourly notifications job uses pg_cron.

## Android (Expo)

`apps/mobile`. See its README. An installable APK needs an Expo account (`eas build --profile preview`); none has been built.
iOS needs an Apple developer account.

## Windows (Tauri)

`apps/desktop`. GitHub Actions, "Desktop (Windows)", Run workflow (or push a `desktop-v*` tag) builds `.exe` and `.msi`
installers, attached to the run as the `kkingg-ai-windows` artifact. Unsigned, so SmartScreen warns. The installer has been
built by CI but never installed or opened.
