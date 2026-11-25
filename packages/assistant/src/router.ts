import type { Embedder, Intent } from "./types";
import { dot, normalize, normalizeText } from "./vector";

export type Match = { id: string; score: number };
export type RouteResult =
  | { matched: true; id: string; score: number; runnerUp: Match | null }
  | { matched: false; best: Match | null };

export type Router = {
  readonly embedderName: string;
  readonly threshold: number;
  /** Classifies a message. Never runs anything: it only picks an intent (or none). */
  route(text: string): Promise<RouteResult>;
};

export const DEFAULT_THRESHOLD = 0.65;

/**
 * Embeds and normalises every example phrase once, here, so each message afterwards costs one embedding plus a
 * handful of dot products. A message matches the intent whose best example is most similar, if that similarity
 * reaches the threshold; otherwise nothing matches.
 */
export async function createRouter(
  intents: Readonly<Record<string, Intent>>,
  embedder: Embedder,
  options: { threshold?: number } = {},
): Promise<Router> {
  const ids: string[] = [];
  const phrases: string[] = [];
  for (const [id, intent] of Object.entries(intents))
    for (const ex of intent.examples) {
      ids.push(id);
      phrases.push(normalizeText(ex));
    }
  const vectors = (await embedder.embed(phrases)).map((v) => normalize(v));
  const threshold = options.threshold ?? embedder.defaultThreshold;

  return {
    embedderName: embedder.name,
    threshold,
    async route(text) {
      const cleaned = normalizeText(text);
      if (!cleaned) return { matched: false, best: null };
      const [q] = await embedder.embed([cleaned]);
      const query = normalize(q!);
      const best = new Map<string, number>();
      for (let i = 0; i < vectors.length; i++) {
        const s = dot(query, vectors[i]!);
        const id = ids[i]!;
        if (s > (best.get(id) ?? -Infinity)) best.set(id, s);
      }
      const ranked = [...best.entries()]
        .map(([id, score]) => ({ id, score }))
        .sort((a, b) => b.score - a.score);
      const top = ranked[0] ?? null;
      if (!top || top.score < threshold) return { matched: false, best: top };
      return { matched: true, id: top.id, score: top.score, runnerUp: ranked[1] ?? null };
    },
  };
}
