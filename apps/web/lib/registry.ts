import { ModuleRegistry } from "@kkingg/module-registry";

/** Single source of truth for modules; navigation is derived from this. */
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

/** Until workspace_modules exists (Phase 2/6), only core modules are enabled. */
export const enabledModules: ReadonlySet<string> = new Set(["dashboard"]);
