# Module Registry

Implemented in `packages/module-registry`. Modules have id, name, description, version, status
(planned | experimental | active | deprecated), dependencies, permissions and nav config.

Registered in the web app (`apps/web/lib/registry.ts`): `dashboard` (active), `tasks` (planned).
Database-backed activation (`module_registry`, `workspace_modules`) arrives in Phases 2 and 6.
