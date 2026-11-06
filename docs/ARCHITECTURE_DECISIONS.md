# Architecture Decisions

## ADR-001: New dedicated Supabase project

The only existing project (`cuc-financial-reporting`) was unrelated and paused, so a new project
`kkingg-ai` was created in eu-central-1 (closest available region to Kampala). The old project was not touched.

## ADR-002: Source-exported workspace packages

Shared packages export TypeScript source directly (`main: src/index.ts`) and are transpiled by consumers
(`transpilePackages` in Next). No per-package build step until one is needed.

## ADR-003: Styling

Phase 1 web shell uses inline styles from design tokens. Tailwind + shadcn/ui are planned for Phase 4.

## ADR-004: Tailwind v4 with hand-built components (supersedes ADR-003)

Tailwind v4 with the theme defined in `apps/web/app/globals.css`, mirroring `@kkingg/design-tokens`
(keep both in sync). Components are hand-written with lucide icons and native `<details>` menus rather than
a component library, to avoid dependencies until a component genuinely needs one. Revisit shadcn/ui when
dialogs, comboboxes or tables are needed.

## ADR-005: Active workspace stored in an httpOnly cookie

The cookie is only a preference; `resolveWorkspace` honours it only when the user can see that workspace
(RLS-limited list), so a forged value falls back to the first workspace.
