# Module Registry

Implemented in `packages/module-registry`. Modules have id, name, description, version, status
(planned | experimental | active | deprecated), dependencies, permissions and nav config.

Code-side definitions (navigation, status, core flag) live in `apps/web/lib/registry.ts`; the database mirrors
them in `module_registry` and records per-workspace activation in `workspace_modules`. Keep the two in sync.

## Activation (Phase 6)

Per-workspace activation lives in `workspace_modules`. Owners and admins toggle it at `/settings/modules`.
The database enforces the rules (see migration 4): dependencies must be enabled first, a module needed by an
enabled module cannot be disabled, core modules (Dashboard) cannot be disabled, and clients cannot add or remove
rows. The sidebar is generated from the code registry filtered by the workspace's enabled modules. Registered:
dashboard (core), tasks, projects, goals, calendar, habits, ideas, vault.
