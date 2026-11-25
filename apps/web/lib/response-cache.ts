import { createClient } from "@supabase/supabase-js";
import type { CacheHit, CacheStore } from "@kkingg/assistant";

const DIMENSIONS = 384;
const asVector = (v: Float32Array) => `[${Array.from(v, (x) => Number(x.toFixed(6))).join(",")}]`;

type Row = {
  id: string;
  query_text: string;
  response_text: string;
  source_fact_ids: string[];
  similarity: number;
};

/**
 * The shared semantic cache in Supabase (`response_cache`). It is reachable ONLY with the service-role key, which stays on
 * the server (never in the phone app or the browser). Returns null, switching Tier 2 off, when the key is not set.
 * Vectors from another model size are ignored, so the n-gram backup can never poison the cache.
 */
export function responseCacheStore(env: Record<string, string | undefined>): CacheStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    async lookup(embedding, embedder, minSimilarity) {
      if (embedding.length !== DIMENSIONS) return [];
      const { data, error } = await db.rpc("match_response_cache", {
        q: asVector(embedding),
        p_embedder: embedder,
        min_sim: minSimilarity,
        n: 3,
      });
      if (error) throw new Error("cache lookup failed");
      return ((data ?? []) as Row[]).map((r): CacheHit => ({
        id: r.id,
        queryText: r.query_text,
        responseText: r.response_text,
        sourceFactIds: r.source_fact_ids,
        similarity: r.similarity,
      }));
    },
    async touch(id) {
      await db.rpc("touch_response_cache", { p_id: id });
    },
    async store(e) {
      if (e.embedding.length !== DIMENSIONS) return;
      const { error } = await db.from("response_cache").insert({
        query_text: e.queryText,
        embedding: asVector(e.embedding),
        embedder: e.embedder,
        response_text: e.responseText,
        source_fact_ids: e.sourceFactIds,
      });
      if (error) throw new Error("cache write failed");
    },
    async invalidateByFact(factId) {
      const { data, error } = await db.rpc("invalidate_response_cache", { p_fact: factId });
      if (error) throw new Error("cache invalidation failed");
      return Number(data ?? 0);
    },
    async prune(maxEntries) {
      const { data, error } = await db.rpc("prune_response_cache", { max_rows: maxEntries });
      if (error) throw new Error("cache cleanup failed");
      return Number(data ?? 0);
    },
  };
}
