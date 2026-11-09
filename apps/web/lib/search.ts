export type SearchHit = { kind: string; id: string; title: string; snippet: string; href: string };

/** Display label and owning module for each kind returned by `search_workspace`. */
export const SEARCH_KINDS: Record<string, { label: string; module: string }> = {
  task: { label: "Tasks", module: "tasks" },
  project: { label: "Projects", module: "projects" },
  goal: { label: "Goals", module: "goals" },
  event: { label: "Events", module: "calendar" },
  habit: { label: "Habits", module: "habits" },
  idea: { label: "Ideas", module: "ideas" },
  vault: { label: "Vault", module: "vault" },
  conversation: { label: "Assistant chats", module: "assistant" },
  course: { label: "Courses", module: "academics" },
  study_note: { label: "Study notes", module: "academics" },
  deck: { label: "Flashcard decks", module: "flashcards" },
  card: { label: "Flashcards", module: "flashcards" },
  application: { label: "Job applications", module: "career" },
  interview: { label: "Interview questions", module: "career" },
  portfolio: { label: "Portfolio", module: "career" },
};

export type SearchGroup = { kind: string; label: string; hits: SearchHit[] };

/** Groups hits by kind in a stable order, dropping kinds that are unknown or whose module is not enabled. */
export function groupHits(hits: SearchHit[], enabled: ReadonlySet<string>): SearchGroup[] {
  return Object.entries(SEARCH_KINDS)
    .filter(([, meta]) => enabled.has(meta.module))
    .map(([kind, meta]) => ({ kind, label: meta.label, hits: hits.filter((h) => h.kind === kind) }))
    .filter((g) => g.hits.length > 0);
}

/** A query must be 2-100 characters after trimming; returns the cleaned query or null. */
export function cleanQuery(raw: string | undefined): string | null {
  const q = (raw ?? "").trim().slice(0, 100);
  return q.length >= 2 ? q : null;
}
