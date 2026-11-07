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
  core: true,
  nav: { label: "Dashboard", href: "/", icon: "layout-dashboard", order: 0 },
});

registry.register({
  id: "tasks",
  name: "Tasks",
  description: "Tasks, projects and goals",
  version: "0.1.0",
  status: "active",
  nav: { label: "Tasks", href: "/tasks", icon: "check-square", order: 10 },
});

for (const [id, name, description, href, icon, order] of [
  ["projects", "Projects", "Projects and milestones", "/projects", "folder-kanban", 20],
  ["goals", "Goals", "Measurable goals and progress", "/goals", "target", 30],
  ["calendar", "Calendar", "Events and schedule", "/calendar", "calendar", 40],
  ["habits", "Habits", "Daily and weekly habits", "/habits", "repeat", 50],
] as const) {
  registry.register({
    id,
    name,
    description,
    version: "0.1.0",
    status: "active",
    nav: { label: name, href, icon, order },
  });
}

registry.register({
  id: "ideas",
  name: "Idea Inbox",
  description: "Capture and track future ideas",
  version: "0.1.0",
  status: "active",
  nav: { label: "Idea Inbox", href: "/ideas", icon: "lightbulb", order: 90 },
});
