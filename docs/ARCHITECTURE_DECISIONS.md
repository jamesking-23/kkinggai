# Architecture Decisions

## ADR-001: New dedicated Supabase project

The only existing project (`cuc-financial-reporting`) was unrelated and paused, so a new project
`kkingg-ai` was created in eu-central-1 (closest available region to Kampala). The old project was not touched.

## ADR-002: Source-exported workspace packages

Shared packages export TypeScript source directly (`main: src/index.ts`) and are transpiled by consumers
(`transpilePackages` in Next). No per-package build step until one is needed.

## ADR-003: Styling

Phase 1 web shell uses inline styles from design tokens. Tailwind + shadcn/ui are planned for Phase 4.
