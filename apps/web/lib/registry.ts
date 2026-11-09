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

registry.register({
  id: "vault",
  name: "Vault",
  description: "Private notes, links and documents",
  version: "0.1.0",
  status: "active",
  nav: { label: "Vault", href: "/vault", icon: "lock", order: 20 },
});

registry.register({
  id: "assistant",
  name: "Assistant",
  description: "Chat with the KKINGG AI assistant",
  version: "0.1.0",
  status: "active",
  nav: { label: "Assistant", href: "/assistant", icon: "sparkles", order: 5 },
});

registry.register({
  id: "academics",
  name: "Academics",
  description: "Courses, assignments and study notes",
  version: "0.1.0",
  status: "active",
  nav: { label: "Academics", href: "/academics", icon: "graduation-cap", order: 60 },
});

registry.register({
  id: "flashcards",
  name: "Flashcards",
  description: "Spaced-repetition flashcards",
  version: "0.1.0",
  status: "active",
  nav: { label: "Flashcards", href: "/flashcards", icon: "layers", order: 62 },
});

registry.register({
  id: "career",
  name: "Career",
  description: "Applications, CV, interview prep and portfolio",
  version: "0.1.0",
  status: "active",
  nav: { label: "Career", href: "/career", icon: "briefcase", order: 64 },
});
