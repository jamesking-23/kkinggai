import { ModuleRegistry } from "@kkingg/module-registry";

/**
 * Code-side module definitions (navigation, status). Which modules a workspace has enabled is read
 * from the `workspace_modules` table; this registry decides how enabled modules appear.
 * Keep in sync with the seed rows in `module_registry`.
 */
export const registry = new ModuleRegistry();

registry.register({
  id: "dashboard",
  name: "Dashboard",
  description: "Overview of your workspace",
  version: "0.1.0",
  status: "active",
  nav: { label: "Dashboard", href: "/", icon: "layout-dashboard", order: 0 },
});

registry.register({
  id: "tasks",
  name: "Tasks",
  description: "Tasks, projects and goals",
  version: "0.1.0",
  status: "planned",
  nav: { label: "Tasks", href: "/tasks", icon: "check-square", order: 10 },
});
