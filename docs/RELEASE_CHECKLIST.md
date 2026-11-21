# Release checklist

Mark each item only when it has actually been done. "Written" is not "tested".

## Automated (run on every push; CI is green on `c2219bd`)

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- [x] Migrations applied to the Supabase project and a live RLS test run per module
- [x] Security advisors reviewed

## Owner actions (cannot be done from the development sandbox)

- [x] `GEMINI_API_KEY` is set in Vercel (done 2026-11-20, sensitive variable). Still open: make one real AI call from the signed-in assistant to confirm the key works; the key was pasted in chat, so consider rotating it
- [ ] Strava: the API connection was removed. In Strava settings, revoke the app and regenerate or delete the client secret you pasted earlier, and remove `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` from Vercel
- [ ] Revoke the GitHub token pasted earlier
- [ ] Supabase Auth: Site URL and redirect URLs; consider disabling public sign-up; enable leaked-password protection
- [ ] Create an Expo account and token for an Android APK (`eas build --profile preview`)
- [ ] Download the Windows installer from the Desktop workflow run's artifact and install it

## Manual smoke test, signed in (never done yet)

- [ ] Sign up or sign in on https://kkingg-ai.vercel.app
- [ ] Create a task, goal, habit and reminder; reload and confirm they persist
- [ ] Add a journal entry and an important date
- [ ] Add a venture and a ledger entry
- [ ] Add a news feed (a real RSS URL) and refresh it
- [ ] Import a PGN, and GPX/TCX files exported from Strava and MapMyRun (several at once)
- [ ] Two accounts: create a chess game, join by link, play a few moves, resign
- [ ] Confirm the notifications job fires (hourly) and an item appears
- [ ] Mobile app: sign in on a device or emulator
- [ ] Desktop app: launch, confirm it loads the site

## Release

- [ ] Run `pnpm audit` again
- [ ] Update `DEVELOPMENT_STATUS.md` with what was actually observed
- [ ] Tag `v0.1.0` only after the smoke test above passes
