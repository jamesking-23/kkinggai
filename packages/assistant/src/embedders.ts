import { normalize, normalizeText } from "./vector";
import type { Embedder } from "./types";

const DIMS = 1024;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "is",
  "are",
  "me",
  "my",
  "i",
  "you",
  "it",
  "for",
  "and",
  "in",
  "on",
  "please",
  "can",
  "could",
  "do",
  "does",
  "what",
  "whats",
  "how",
  "now",
  "just",
  "give",
  "show",
  "tell",
]);

/**
 * A small, fully offline, dependency-free embedder: hashed word and character-trigram counts. It copes with typos
 * and broken grammar, but it only matches spelling, not meaning. It is the backup when the real model files are not
 * installed, and what the tests use. Its similarities are lower than a neural model's, hence a lower default threshold.
 */
export function ngramEmbedder(): Embedder {
  return {
    name: "ngram-hash",
    defaultThreshold: 0.4,
    async embed(texts) {
      return texts.map((raw) => {
        const v = new Float32Array(DIMS);
        const words = normalizeText(raw).split(" ").filter(Boolean);
        for (const w of words) {
          const weight = STOP.has(w) ? 0.25 : 1;
          v[hash(`w:${w}`) % DIMS]! += weight;
          const padded = ` ${w} `;
          for (let i = 0; i + 3 <= padded.length; i++)
            v[hash(`c:${padded.slice(i, i + 3)}`) % DIMS]! += 0.5 * weight;
        }
        return normalize(v);
      });
    },
  };
}
