import { executeIntent, FALLBACK_REPLY, type AssistantReply } from "./assistant";
import {
  CACHE_MAX_ENTRIES,
  cleanupCache,
  isCacheable,
  numbersMatch,
  type CacheStore,
} from "./cache";
import { FACTS, factRef, topFacts, type Fact } from "./facts";
import { INTENTS } from "./intents";
import { createRouter } from "./router";
import type { AssistantData, Embedder, Intent } from "./types";
import { normalize } from "./vector";

/** Tier 2 accepts a stored answer at this similarity or above (and only when the numbers match). */
export const CACHE_THRESHOLD = 0.9;

/** Thrown by the Tier 3 function when it cannot reach the internet. The pipeline answers with a friendly offline message. */
export class LlmOffline extends Error {}
/** Thrown by the Tier 3 function when it must not (or cannot) answer; the message is shown as is and nothing is cached. */
export class LlmRefused extends Error {}

/** Tier 3: asks the online AI. It receives only the question and public app facts. */
export type Llm = (req: { query: string; facts: Fact[] }) => Promise<string>;

export const OFFLINE_REPLY =
  "I can't reach the online helper right now (no internet connection on the server's side), and I don't have a stored answer to that. " +
  'I can still run my built-in commands: say "help" to see them.';

export type Tier = 1 | 2 | 3 | 0;
export type PipelineReply = AssistantReply & {
  /** 1 = built-in command, 2 = shared cache, 3 = online AI, 0 = nothing could answer. */
  tier: Tier;
  /** Tier 3 only: the answer was written to the shared cache. */
  cached?: boolean;
};

export type PipelineEnv = {
  data: AssistantData;
  now?: Date;
  timeZone?: string;
  /** Tier 3 for this request (it may need the caller's own limits and history). Overrides the pipeline's default. */
  llm?: Llm | null;
};

export type Pipeline = {
  readonly embedderName: string;
  readonly threshold: number;
  reply(text: string, env: PipelineEnv): Promise<PipelineReply>;
};

/**
 * The three-tier assistant. The message is embedded ONCE and that vector is reused by every tier.
 *  Tier 1: match a built-in command (threshold `embedder.defaultThreshold`, 0.72 for the local model) and run its function.
 *  Tier 2: if it is a cacheable general question, look for a stored answer (similarity >= 0.90, same numbers).
 *  Tier 3: otherwise ask the online AI with relevant public app facts, store the answer, and return it.
 * Tiers 2 and 3 are optional: without a cache or an `llm` the assistant is fully offline.
 */
export async function createPipeline(options: {
  embedder: Embedder;
  threshold?: number;
  intents?: Readonly<Record<string, Intent>>;
  cache?: CacheStore | null;
  llm?: Llm | null;
  facts?: readonly Fact[];
  cacheThreshold?: number;
  maxCacheEntries?: number;
}): Promise<Pipeline> {
  const intents = options.intents ?? INTENTS;
  const facts = options.facts ?? FACTS;
  const router = await createRouter(intents, options.embedder, { threshold: options.threshold });
  const factVectors = (await options.embedder.embed(facts.map((f) => f.text))).map((v) =>
    normalize(v),
  );
  const cacheThreshold = options.cacheThreshold ?? CACHE_THRESHOLD;
  const maxEntries = options.maxCacheEntries ?? CACHE_MAX_ENTRIES;
  const currentRefs = new Set(facts.map(factRef));
  // Facts are only worth sending when they are clearly related to the question.
  const factFloor = Math.max(0.1, router.threshold - 0.2);
  let writes = 0;

  const reply = async (text: string, env: PipelineEnv): Promise<PipelineReply> => {
    const llm = env.llm === undefined ? options.llm : env.llm;
    const trimmed = text.trim();
    const query = await router.embedQuery(trimmed);
    if (!query)
      return { text: FALLBACK_REPLY, intent: null, score: null, unmatched: true, tier: 0 };

    // Tier 1
    const hit = router.routeVector(query);
    if (hit.matched)
      return { ...(await executeIntent(intents, hit.id, hit.score, trimmed, env)), tier: 1 };
    const best = hit.best?.score ?? null;

    const cacheable = isCacheable(trimmed);

    // Tier 2
    if (cacheable && options.cache) {
      try {
        const hits = await options.cache.lookup(query, router.embedderName, cacheThreshold);
        for (const h of hits) {
          if (!numbersMatch(h.queryText, trimmed)) continue;
          if (!h.sourceFactIds.every((r) => currentRefs.has(r))) continue; // built from an outdated fact
          void options.cache.touch(h.id).catch(() => undefined);
          return {
            text: h.responseText,
            intent: null,
            score: h.similarity,
            unmatched: false,
            tier: 2,
          };
        }
      } catch {
        // A broken cache must never break the assistant: carry on to Tier 3.
      }
    }

    // Tier 3
    if (!llm) return { text: FALLBACK_REPLY, intent: null, score: best, unmatched: true, tier: 0 };
    const related = topFacts(query, facts, factVectors, 3, factFloor);
    let answer: string;
    try {
      answer = (await llm({ query: trimmed, facts: related })).trim();
    } catch (e) {
      if (e instanceof LlmOffline)
        return { text: OFFLINE_REPLY, intent: null, score: best, unmatched: true, tier: 0 };
      if (e instanceof LlmRefused)
        return { text: e.message, intent: null, score: best, unmatched: true, tier: 0 };
      return {
        text: 'The online helper could not answer just now. Try again in a moment, or say "help" to see what I can do offline.',
        intent: null,
        score: best,
        unmatched: true,
        tier: 0,
      };
    }
    if (!answer)
      return { text: FALLBACK_REPLY, intent: null, score: best, unmatched: true, tier: 0 };

    let cached = false;
    if (cacheable && options.cache) {
      try {
        // Saved BEFORE the answer is returned, so the next person who asks something similar gets it for free.
        await options.cache.store({
          queryText: trimmed.slice(0, 500),
          embedding: query,
          embedder: router.embedderName,
          responseText: answer.slice(0, 8000),
          sourceFactIds: related.map(factRef),
        });
        cached = true;
        if (++writes % 25 === 0)
          void cleanupCache(options.cache, maxEntries).catch(() => undefined);
      } catch {
        // Not cached: the user still gets the answer.
      }
    }
    return { text: answer, intent: null, score: best, unmatched: false, tier: 3, cached };
  };

  return { embedderName: router.embedderName, threshold: router.threshold, reply };
}
