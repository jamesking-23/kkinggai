// Project helpers, mirroring the website's rules (apps/web/app/(app)/projects and packages/schemas). Pure.
// Statuses are repeated from the website; keep them in sync.

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectRow = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  due_date: string | null;
  revision: number;
};

const ORDER: Record<ProjectStatus, number> = { active: 0, paused: 1, completed: 2, archived: 3 };

export const statusLabel = (s: ProjectStatus) => s.charAt(0).toUpperCase() + s.slice(1);

/** Moves offered from a status. Archived projects are not shown on the phone, like the website. */
export function nextStatuses(s: ProjectStatus): ProjectStatus[] {
  if (s === "active") return ["paused", "completed", "archived"];
  if (s === "paused") return ["active", "completed", "archived"];
  return ["active", "archived"];
}

/** Active first, then paused, completed; within a status the nearest due date first, undated last. */
export function sortProjects(list: readonly ProjectRow[]): ProjectRow[] {
  return [...list]
    .filter((p) => p.status !== "archived")
    .sort((a, b) => {
      if (ORDER[a.status] !== ORDER[b.status]) return ORDER[a.status] - ORDER[b.status];
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
}

/** Open (to do or in progress) task counts per project id. */
export function openCounts(tasks: readonly { project_id: string | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) if (t.project_id) m.set(t.project_id, (m.get(t.project_id) ?? 0) + 1);
  return m;
}

/** A valid yyyy-mm-dd calendar date, or null. Blank is allowed by the caller. */
export function parseDueDate(text: string): string | null {
  const t = text.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
}

/** Trimmed name and description, or an error message. Limits match the website (200 and 2000 characters). */
export function checkProject(
  name: string,
  description: string,
  due: string,
): { name: string; description: string; due: string | null } | string {
  const n = name.trim();
  if (!n) return "Enter a project name.";
  if (n.length > 200) return "The name is too long (200 characters at most).";
  const d = description.trim();
  if (d.length > 2000) return "The description is too long (2000 characters at most).";
  if (due.trim() === "") return { name: n, description: d, due: null };
  const parsed = parseDueDate(due);
  if (!parsed) return "Enter the due date as YYYY-MM-DD, or leave it blank.";
  return { name: n, description: d, due: parsed };
}
