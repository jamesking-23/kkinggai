// Idea backlog helpers, mirroring the website (statuses from packages/schemas, priority labels from apps/web/lib/productivity.ts).
// The lists are repeated here because the phone app does not depend on those packages; keep them in sync. Pure.

export const IDEA_STATUSES = [
  "captured",
  "planned",
  "in_development",
  "active",
  "experimental",
  "deprecated",
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Normal",
  4: "Low",
};

export type IdeaRow = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  priority: number;
  status: IdeaStatus;
  revision: number;
  created_at: string;
};

export function statusText(s: IdeaStatus): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function priorityText(p: number): string {
  return PRIORITY_LABELS[p] ?? "Normal";
}

/** Counts per status in the website's order, including zeros. */
export function statusCounts(
  ideas: readonly { status: string }[],
): { status: IdeaStatus; count: number }[] {
  return IDEA_STATUSES.map((status) => ({
    status,
    count: ideas.filter((i) => i.status === status).length,
  }));
}

/** Most urgent first, then newest first. */
export function sortIdeas(ideas: readonly IdeaRow[]): IdeaRow[] {
  return [...ideas].sort(
    (a, b) => a.priority - b.priority || Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}

export function filterIdeas(
  ideas: readonly IdeaRow[],
  status: IdeaStatus | "all",
  query: string,
): IdeaRow[] {
  const q = query.trim().toLowerCase();
  return ideas.filter(
    (i) =>
      (status === "all" || i.status === status) &&
      (!q ||
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q)),
  );
}

/** Trimmed single-line title capped at 200, or null when empty. */
export function cleanTitle(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, 200) : null;
}

/** Trimmed note capped at 4000 (line breaks kept). */
export function cleanNote(raw: string): string {
  return raw.trim().slice(0, 4000);
}
