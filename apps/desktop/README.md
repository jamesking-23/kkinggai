# KKINGG AI desktop (Tauri)

A native Windows (and macOS/Linux) shell around the hosted web app at https://kkingg-ai.vercel.app. It is **not** a separate
native interface: the window opens a small bundled start page, which checks the site is reachable and then loads it, or shows a
retry message when offline.

## Security model

- The window is granted **no native permissions** (`src-tauri/capabilities/default.json` has an empty list), so the hosted site
  cannot call into the operating system.
- In-window navigation is limited to the bundled start page and `https://kkingg-ai.vercel.app` (`allow_in_window` in
  `src-tauri/src/lib.rs`, unit-tested). Everything else is refused inside the window.
- No secrets live in this app.

## Build

- Locally (Windows): install Rust and Node, then `pnpm install` and `pnpm --filter @kkingg/desktop build`.
- On GitHub: Actions, "Desktop (Windows)", Run workflow. The installers (`.exe` and `.msi`) are attached to the run as the
  `kkingg-ai-windows` artifact. They are not code-signed, so Windows SmartScreen will warn when installing.

The icons are generated from the placeholder Expo icon (`pnpm --filter @kkingg/desktop icons`); replace
`apps/mobile/assets/icon.png` with real artwork and regenerate them.
