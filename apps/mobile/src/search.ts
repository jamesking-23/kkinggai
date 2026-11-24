// Search helpers, mirroring apps/web/lib/search.ts (same server function, same grouping and word matching),
// plus the routing that decides which native screen a result or module path opens. Pure.
// The kind list is repeated from the website; keep them in sync.

export type SearchHit = { kind: string; id: string; title: string; snippet: string; href: string };

export const SEARCH_KINDS: Record<string, { label: string; module: string }> = {
  task: { label: "Tasks", module: "tasks" },
  attachment: { label: "Task files", module: "tasks" },
  project: { label: "Projects", module: "projects" },
  goal: { label: "Goals", module: "goals" },
  event: { label: "Events", module: "calendar" },
  habit: { label: "Habits", module: "habits" },
  idea: { label: "Ideas", module: "ideas" },
  vault: { label: "Vault", module: "vault" },
  conversation: { label: "Assistant chats", module: "assistant" },
  course: { label: "Courses", module: "academics" },
  study_note: { label: "Study notes", module: "academics" },
  research: { label: "Research sources", module: "academics" },
  deck: { label: "Flashcard decks", module: "flashcards" },
  card: { label: "Flashcards", module: "flashcards" },
  application: { label: "Job applications", module: "career" },
  interview: { label: "Interview questions", module: "career" },
  portfolio: { label: "Portfolio", module: "career" },
  venture: { label: "Ventures", module: "business" },
  chess_game: { label: "Chess games", module: "chess" },
  run: { label: "Runs", module: "running" },
};

export type SearchGroup = { kind: string; label: string; hits: SearchHit[] };

/** Groups hits by kind in a stable order, dropping unknown kinds and kinds whose module is not enabled. */
export function groupHits(hits: readonly SearchHit[], enabled: ReadonlySet<string>): SearchGroup[] {
  return Object.entries(SEARCH_KINDS)
    .filter(([, meta]) => enabled.has(meta.module))
    .map(([kind, meta]) => ({ kind, label: meta.label, hits: hits.filter((h) => h.kind === kind) }))
    .filter((g) => g.hits.length > 0);
}

/** 2-100 characters after trimming, else null. */
export function cleanQuery(raw: string | undefined): string | null {
  const q = (raw ?? "").trim().slice(0, 100);
  return q.length >= 2 ? q : null;
}

export const MAX_TERMS = 4;

/** Words, or "quoted phrases" kept whole; terms under 2 characters dropped, duplicates removed, at most 4. */
export function splitTerms(q: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const term = (m[1] ?? m[2] ?? "").trim().replace(/^"+|"+$/g, "");
    const key = term.toLowerCase();
    if (term.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length === MAX_TERMS) break;
  }
  return out;
}

/** Hits present in every list (same kind and id), in the order of the first list. */
export function intersectHits(lists: readonly (readonly SearchHit[])[]): SearchHit[] {
  const [first, ...rest] = lists;
  if (!first) return [];
  const sets = rest.map((l) => new Set(l.map((h) => `${h.kind}:${h.id}`)));
  return first.filter((h) => sets.every((s) => s.has(`${h.kind}:${h.id}`)));
}

export type Route =
  | { type: "screen"; screen: NativeScreen }
  | { type: "tab"; tab: "tasks" }
  | { type: "web"; path: string };

export type NativeScreen =
  | "calendar"
  | "habits"
  | "goals"
  | "career"
  | "academics"
  | "business"
  | "chess"
  | "ideas"
  | "running"
  | "flashcards"
  | "projects"
  | "personal"
  | "news"
  | "entertainment"
  | "vault"
  | "search";

const NATIVE: ReadonlySet<string> = new Set<NativeScreen>([
  "calendar",
  "habits",
  "goals",
  "career",
  "academics",
  "business",
  "chess",
  "ideas",
  "running",
  "flashcards",
  "projects",
  "personal",
  "news",
  "entertainment",
  "vault",
  "search",
]);

/** Where a site path opens on the phone: a native screen, the Tasks tab, or the Website tab. */
export function routeFor(path: string): Route {
  const first = path.split(/[?#]/)[0]!.split("/").filter(Boolean)[0] ?? "";
  if (first === "tasks") return { type: "tab", tab: "tasks" };
  if (NATIVE.has(first)) return { type: "screen", screen: first as NativeScreen };
  return { type: "web", path };
}

/** Splits text into plain and matching pieces for highlighting (case-insensitive). */
export function highlight(
  text: string,
  terms: readonly string[],
): { text: string; match: boolean }[] {
  const usable = terms.filter((t) => t.length > 0);
  if (!text || usable.length === 0) return [{ text, match: false }];
  const escaped = usable
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text
    .split(re)
    .filter((s) => s !== "")
    .map((s) => ({ text: s, match: usable.some((t) => t.toLowerCase() === s.toLowerCase()) }));
}
