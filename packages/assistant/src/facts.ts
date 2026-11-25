/**
 * Public facts about the app, used as the context ("RAG") for Tier 3 and as the source ids of cached answers.
 * These are NOT user data: they are the same for everyone, which is what makes sharing cached answers safe.
 * When you change a fact's text, bump its `version`: answers built from the old version stop being served, and
 * `invalidateCacheByFact(id)` removes them.
 */
export type Fact = { id: string; version: number; text: string };

export const factRef = (f: Fact) => `${f.id}@${f.version}`;

export const FACTS: readonly Fact[] = [
  {
    id: "app-overview",
    version: 1,
    text: "KKINGG AI is a private, modular personal operating system. Each module (tasks, calendar, habits, goals, career, academics, business, chess, ideas, running, flashcards, projects, personal journal, news, entertainment, vault, search) can be switched on or off in Settings. It runs on the web and as an Android app.",
  },
  {
    id: "tasks",
    version: 1,
    text: "Tasks have a title, optional due date, priority and status. Completing a recurring task creates the next one. Tasks can have attachments. The assistant can list open tasks, list tasks due today and add a task.",
  },
  {
    id: "habits-goals",
    version: 1,
    text: "Habits are logged once per day and the app tracks streaks. Goals have a target value, current value, unit and optional deadline, and show progress as a percentage.",
  },
  {
    id: "running",
    version: 1,
    text: "The running module records runs (distance, time, kind), shows weekly totals and trends, keeps a training plan with planned sessions, and can import activities from Strava. Runs can also be logged by hand or through the assistant.",
  },
  {
    id: "chess",
    version: 1,
    text: "The chess module has puzzles built from your own mistakes (spaced-repetition review), a game history with a move-by-move viewer, and live games against a friend through an invite link with optional clocks, draw offers, resign, rematch and premoves.",
  },
  {
    id: "vault",
    version: 1,
    text: "The Vault stores sensitive notes. On the phone it can be locked behind the device's screen lock or fingerprint, and it re-locks after the app has been in the background for 30 seconds. The assistant never reads the vault.",
  },
  {
    id: "assistant",
    version: 1,
    text: "The assistant answers in three steps. First it matches your message against a list of built-in commands using a small language model that runs on the server with no internet use. If that fails it looks for a stored answer to a similar general question. Only if both fail does it ask an online AI (Gemini), and it sends that service only your question and public app facts, never your tasks, notes or vault.",
  },
  {
    id: "notifications",
    version: 1,
    text: "Notifications appear in an in-app inbox, filled by a scheduled job for things like due tasks and important dates. Web push is available in supported browsers; push to the Android app is not set up.",
  },
  {
    id: "search",
    version: 1,
    text: "Search looks across tasks, notes, ideas, goals and other modules at once, and results open the matching screen.",
  },
  {
    id: "privacy",
    version: 1,
    text: "Data is stored in the owner's Supabase database with row-level security so each account only sees its own rows. The phone app uses a publishable key and the signed-in session; it never holds a service-role key.",
  },
];

/** The facts most similar to a question, best first. Vectors must be normalised with the same embedder as the query. */
export function topFacts(
  query: Float32Array,
  facts: readonly Fact[],
  vectors: readonly Float32Array[],
  k: number,
  minSimilarity: number,
): Fact[] {
  return facts
    .map((f, i) => {
      let s = 0;
      const v = vectors[i]!;
      for (let j = 0; j < Math.min(v.length, query.length); j++) s += v[j]! * query[j]!;
      return { f, s };
    })
    .filter((x) => x.s >= minSimilarity)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.f);
}
