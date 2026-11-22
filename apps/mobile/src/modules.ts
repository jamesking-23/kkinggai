// The website's modules, for the native Home grid. Each opens its page in the Website tab until a native screen exists.
export type ModuleLink = { id: string; label: string; hint: string; path: string };

export const MODULES: readonly ModuleLink[] = [
  { id: "assistant", label: "Assistant", hint: "Ask anything", path: "/assistant" },
  { id: "calendar", label: "Calendar", hint: "Events and due dates", path: "/calendar" },
  { id: "chess", label: "Chess", hint: "Play and practise", path: "/chess" },
  { id: "academics", label: "Academics", hint: "Courses and deadlines", path: "/academics" },
  { id: "career", label: "Career", hint: "Applications", path: "/career" },
  { id: "business", label: "Business", hint: "Ventures", path: "/business" },
  { id: "habits", label: "Habits", hint: "Daily streaks", path: "/habits" },
  { id: "goals", label: "Goals", hint: "What you are working toward", path: "/goals" },
  { id: "running", label: "Running", hint: "Runs and routes", path: "/running" },
  { id: "sports", label: "Sports", hint: "Scores and teams", path: "/sports" },
  { id: "projects", label: "Projects", hint: "Work in progress", path: "/projects" },
  { id: "ideas", label: "Ideas", hint: "Capture quickly", path: "/ideas" },
  { id: "flashcards", label: "Flashcards", hint: "Study", path: "/flashcards" },
  { id: "news", label: "News", hint: "Your feeds", path: "/news" },
  { id: "entertainment", label: "Entertainment", hint: "Watch and read", path: "/entertainment" },
  { id: "personal", label: "Personal", hint: "Life admin", path: "/personal" },
  { id: "vault", label: "Vault", hint: "Private notes", path: "/vault" },
  { id: "search", label: "Search", hint: "Find anything", path: "/search" },
  { id: "settings", label: "Settings", hint: "Workspace and modules", path: "/settings" },
];

/** "Good morning/afternoon/evening" from the hour (0-23) of the phone's local time. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Case-insensitive filter on label and hint; an empty query returns everything. */
export function filterModules(query: string, list: readonly ModuleLink[] = MODULES): ModuleLink[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter((m) => m.label.toLowerCase().includes(q) || m.hint.toLowerCase().includes(q));
}
