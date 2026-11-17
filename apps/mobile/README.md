# KKINGG AI mobile (Expo)

A real React Native app (not a web wrapper). Version 0.1: sign in, notifications inbox (mark read), open tasks (read-only), sign out.

## Run

1. Copy `.env.example` to `.env` and fill in the Supabase URL and publishable key (the same ones the website uses).
2. `pnpm --filter @kkingg/mobile start`, then open it in Expo Go or an emulator.

## Build an Android APK (needs an Expo account; not done from the development sandbox)

```
cd apps/mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Set the two `EXPO_PUBLIC_*` values as EAS environment variables first (they are inlined into the bundle at build time).
iOS builds need an Apple developer account and a Mac or EAS cloud build.

## Security

Only public values belong here. Never add a service-role key, an AI key or other secrets. All data access goes through the
signed-in user's session and row-level security.
