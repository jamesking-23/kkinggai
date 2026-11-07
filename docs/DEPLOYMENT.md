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
