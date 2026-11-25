import { describe, expect, it, vi } from "vitest";
import {
  CACHE_MAX_ENTRIES,
  invalidateCacheByFact,
  isCacheable,
  keyNumbers,
  numbersMatch,
  type CacheHit,
  type CacheStore,
} from "./cache";
import { ngramEmbedder } from "./embedders";
import { FACTS, factRef } from "./facts";
import { createPipeline, type Llm, LlmOffline, LlmRefused, OFFLINE_REPLY } from "./pipeline";
import type { AssistantData } from "./types";
import { dot } from "./vector";

const data = {} as AssistantData;
const emb = ngramEmbedder();

type Row = CacheHit & { embedding: Float32Array; embedder: string; used: number };
function memoryCache() {
  const rows: Row[] = [];
  const store: CacheStore = {
    async lookup(q, embedder, min) {
      return rows
        .filter((r) => r.embedder === embedder)
        .map((r) => ({ ...r, similarity: dot(q, r.embedding) }))
        .filter((r) => r.similarity >= min)
        .sort((a, b) => b.similarity - a.similarity);
    },
    async touch(id) {
      const r = rows.find((x) => x.id === id);
      if (r) r.used = Date.now();
    },
    async store(e) {
      rows.push({
        id: `r${rows.length}`,
        queryText: e.queryText,
        responseText: e.responseText,
        sourceFactIds: e.sourceFactIds,
        similarity: 1,
        embedding: e.embedding,
        embedder: e.embedder,
        used: 0,
      });
    },
    async invalidateByFact(f) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i]!.sourceFactIds.some((x) => x === f || x.startsWith(`${f}@`))) rows.splice(i, 1);
      return before - rows.length;
    },
    async prune(max) {
      const before = rows.length;
      rows.sort((a, b) => b.used - a.used);
      rows.length = Math.min(rows.length, max);
      return before - rows.length;
    },
  };
  return { rows, store };
}

describe("cacheability", () => {
  it("keeps personal, time-sensitive and private text out of the shared cache", () => {
    expect(isCacheable("what is the capital of uganda")).toBe(true);
    expect(isCacheable("how many tasks do I have")).toBe(false);
    expect(isCacheable("what is my pace if I run 10km in 50 minutes")).toBe(false);
    expect(isCacheable("what is the latest news about chess")).toBe(false);
    expect(isCacheable("email me at a@b.com about training")).toBe(false);
    expect(isCacheable("hi")).toBe(false);
  });
  it("compares key numbers", () => {
    expect(keyNumbers("run 10 km then 1,200.0 m")).toEqual(["10", "1200"]);
    expect(numbersMatch("convert 5 miles to km", "how many km is 5 miles")).toBe(true);
    expect(numbersMatch("convert 5 miles to km", "convert 6 miles to km")).toBe(false);
  });
});

describe("three-tier pipeline", () => {
  it("Tier 1 runs a built-in command and never touches the cache or the online AI", async () => {
    const llm = vi.fn();
    const { store } = memoryCache();
    const lookup = vi.spyOn(store, "lookup");
    const p = await createPipeline({ embedder: emb, cache: store, llm });
    const r = await p.reply("calculate 15% of 80000", { data });
    expect(r.tier).toBe(1);
    expect(r.text).toContain("12,000");
    expect(llm).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("Tier 3 answers, stores the answer first, then Tier 2 serves a similar question free", async () => {
    const llm = vi.fn(async () => "Kampala is the capital of Uganda.");
    const { rows, store } = memoryCache();
    const p = await createPipeline({ embedder: emb, cache: store, llm });
    const first = await p.reply("what is the capital city of uganda", { data });
    expect(first).toMatchObject({ tier: 3, cached: true });
    expect(rows).toHaveLength(1);
    const second = await p.reply("What is the capital city of Uganda?", { data });
    expect(second.tier).toBe(2);
    expect(second.text).toBe("Kampala is the capital of Uganda.");
    expect(llm).toHaveBeenCalledTimes(1);
    expect(rows[0]!.used).toBeGreaterThan(0); // last_used_at updated
  });

  it("does not reuse an answer when the numbers differ", async () => {
    const llm = vi.fn(async (r: { query: string }) => `answer for ${r.query}`);
    const { store } = memoryCache();
    const p = await createPipeline({ embedder: emb, cache: store, llm });
    await p.reply("who was the president of uganda in 1986", { data });
    const r = await p.reply("who was the president of uganda in 1996", { data });
    expect(r.tier).toBe(3);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it("never caches or serves personal questions", async () => {
    const llm = vi.fn(async () => "something");
    const { rows, store } = memoryCache();
    const p = await createPipeline({ embedder: emb, cache: store, llm });
    const r = await p.reply("why do my eyes water when I chop onions", { data });
    expect(r).toMatchObject({ tier: 3, cached: false });
    expect(rows).toHaveLength(0);
  });

  it("sends the online AI only the question and public facts", async () => {
    const llm = vi.fn<Llm>(async () => "ok");
    const p = await createPipeline({ embedder: emb, llm });
    await p.reply("how does the vault lock work on the phone", { data });
    const req = llm.mock.calls[0]![0] as { query: string; facts: { id: string }[] };
    expect(req.facts.some((f) => f.id === "vault")).toBe(true);
    expect(Object.keys(req).sort()).toEqual(["facts", "query"]);
  });

  it("stops serving answers built from an outdated fact and invalidateCacheByFact removes them", async () => {
    const llm = vi.fn(async () => "The vault locks after 30 seconds.");
    const { rows, store } = memoryCache();
    const p = await createPipeline({ embedder: emb, cache: store, llm });
    await p.reply("how does the vault lock work on the phone", { data });
    expect(rows[0]!.sourceFactIds).toContain(factRef(FACTS.find((f) => f.id === "vault")!));
    const bumped = FACTS.map((f) => (f.id === "vault" ? { ...f, version: f.version + 1 } : f));
    const p2 = await createPipeline({ embedder: emb, cache: store, llm, facts: bumped });
    expect((await p2.reply("how does the vault lock work on the phone", { data })).tier).toBe(3);
    expect(await invalidateCacheByFact(store, "vault")).toBeGreaterThan(0);
    expect(rows.every((r) => !r.sourceFactIds.some((x) => x.startsWith("vault@")))).toBe(true);
  });

  it("gives a friendly message when the online AI cannot be reached, and caches nothing", async () => {
    const { rows, store } = memoryCache();
    const p = await createPipeline({
      embedder: emb,
      cache: store,
      llm: async () => {
        throw new LlmOffline("down");
      },
    });
    const r = await p.reply("explain how photosynthesis works", { data });
    expect(r).toMatchObject({ tier: 0, text: OFFLINE_REPLY });
    expect(rows).toHaveLength(0);
  });

  it("shows a refusal (such as the daily limit) as is", async () => {
    const p = await createPipeline({
      embedder: emb,
      llm: async () => {
        throw new LlmRefused("Daily limit reached.");
      },
    });
    expect((await p.reply("explain how photosynthesis works", { data })).text).toBe(
      "Daily limit reached.",
    );
  });

  it("is fully offline with no cache and no online AI: polite fallback", async () => {
    const p = await createPipeline({ embedder: emb });
    const r = await p.reply("explain how photosynthesis works", { data });
    expect(r).toMatchObject({ tier: 0, unmatched: true });
  });

  it("survives a failing cache and a failing cache write", async () => {
    const llm = vi.fn(async () => "fine");
    const store: CacheStore = {
      lookup: async () => {
        throw new Error("db down");
      },
      touch: async () => undefined,
      store: async () => {
        throw new Error("db down");
      },
      invalidateByFact: async () => 0,
      prune: async () => 0,
    };
    const p = await createPipeline({ embedder: emb, cache: store, llm });
    const r = await p.reply("what is the tallest mountain in africa", { data });
    expect(r).toMatchObject({ tier: 3, text: "fine", cached: false });
  });

  it("trims the cache to its cap (LRU) and the cap is 10,000", async () => {
    expect(CACHE_MAX_ENTRIES).toBe(10_000);
    const { rows, store } = memoryCache();
    for (let i = 0; i < 5; i++)
      await store.store({
        queryText: `q${i}`,
        embedding: new Float32Array([1]),
        embedder: "e",
        responseText: "a",
        sourceFactIds: [],
      });
    rows.forEach((r, i) => (r.used = i));
    expect(await store.prune(3)).toBe(2);
    expect(rows.map((r) => r.queryText).sort()).toEqual(["q2", "q3", "q4"]);
  });
});
