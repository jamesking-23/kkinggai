# Deployment

Not yet configured. Planned: web on Vercel, backend on Supabase project `rlinlmnpzrlbprmcejdk`.
Environment variables are listed in `.env.example`.

## Web (Vercel)

Vercel project `kkingg-ai` (team `kkingg`), linked to `jamesking-23/kkinggai`, root directory `apps/web`,
framework Next.js. Every push to `main` deploys. Environment variables set on the project:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (both public by design).
Vercel Authentication is on (default), so only signed-in Vercel team members can open deployment URLs.

After the first deploy, in Supabase → Authentication → URL Configuration, set the Site URL to the
production URL and add `<production URL>/auth/callback` to the redirect URLs, or email links will not work.

Production URL: https://kkingg-ai.vercel.app (first deployment reached READY on commit `05e3005`; not yet
exercised by a signed-in user).

## Android, iOS and Windows

No mobile or desktop code exists yet (Phases 17 and 18), so there is nothing to build or install.
Planned: Expo (EAS Build for an installable Android APK) and Tauri (Windows installer built on a GitHub Actions
`windows-latest` runner).
