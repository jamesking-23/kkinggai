/**
 * Tier 2: the shared semantic cache. It stores answers to GENERAL questions so the next person asking something similar
 * gets the stored answer for free. Because it is shared between users, nothing personal may ever go in or come out:
 * `isCacheable` keeps personal and time-sensitive questions out, and Tier 3 only ever sees public app facts, never a
 * user's own data.
 */

export type CacheHit = {
  id: string;
  queryText: string;
  responseText: string;
  /** "factId@version" for every fact the answer was built from. */
  sourceFactIds: string[];
  similarity: number;
};

export interface CacheStore {
  /** Closest stored answers (best first) at or above `minSimilarity`, only from the same embedder. */
  lookup(embedding: Float32Array, embedder: string, minSimilarity: number): Promise<CacheHit[]>;
  /** Records a use: sets last_used_at to now. */
  touch(id: string): Promise<void>;
  store(entry: {
    queryText: string;
    embedding: Float32Array;
    embedder: string;
    responseText: string;
    sourceFactIds: string[];
  }): Promise<void>;
  /** Removes every answer built from a fact (any version). Returns how many were removed. */
  invalidateByFact(factId: string): Promise<number>;
  /** Keeps at most `maxEntries` answers, dropping the least recently used. Returns how many were removed. */
  prune(maxEntries: number): Promise<number>;
}

/** The most entries the cache keeps. */
export const CACHE_MAX_ENTRIES = 10_000;

/** Removes every cached answer built from `factId`. Call this when that fact changes. */
export function invalidateCacheByFact(store: CacheStore, factId: string): Promise<number> {
  return store.invalidateByFact(factId);
}

/** LRU cleanup: trims the cache to its cap. Safe to call as often as you like. */
export function cleanupCache(store: CacheStore, max: number = CACHE_MAX_ENTRIES): Promise<number> {
  return store.prune(max);
}

const PERSONAL = /\b(i|i'm|im|i've|ive|i'll|i'd|me|my|mine|myself|we|our|ours|us|your|ur)\b/;
const TIME_SENSITIVE =
  /\b(today|tonight|tomorrow|yesterday|now|currently|current|latest|recent|recently|this (?:week|month|year|morning|evening)|right now|balance|price|prices|rate|rates|score|scores|news|weather|time|date)\b/;

/**
 * True when a question may be stored in (or answered from) the shared cache. Personal questions (about "my" things),
 * time-sensitive ones (today, latest, prices, scores) and anything holding an email, a long number or a very long text
 * are never cached: their answer would be wrong for someone else, or private.
 */
export function isCacheable(query: string): boolean {
  const q = query.toLowerCase().trim();
  if (q.length < 8 || q.length > 300) return false;
  if (PERSONAL.test(q) || TIME_SENSITIVE.test(q)) return false;
  if (/@|https?:\/\//.test(q)) return false;
  if (/\d{6,}/.test(q.replace(/[\s,.-]/g, ""))) return false;
  return true;
}

/** The numbers in a text, as plain strings ("1,200.5" becomes "1200.5"), sorted. */
export function keyNumbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? [])
    .map((n) => n.replace(/,/g, "").replace(/\.0+$/, ""))
    .sort();
}

/** A cached answer may only be reused when the question carries exactly the same numbers. */
export function numbersMatch(a: string, b: string): boolean {
  const x = keyNumbers(a);
  const y = keyNumbers(b);
  return x.length === y.length && x.every((n, i) => n === y[i]);
}
