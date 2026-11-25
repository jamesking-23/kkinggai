export { createAssistant, FALLBACK_REPLY, type Assistant, type AssistantReply } from "./assistant";
export { INTENTS, greetingChoice } from "./intents";
export { createRouter, DEFAULT_THRESHOLD, type Router, type RouteResult } from "./router";
export { ngramEmbedder } from "./embedders";
export { evaluate, extractExpression, CalcError } from "./calc";
export { MissingInput } from "./types";
export type { ActionContext, AssistantData, Embedder, Intent } from "./types";
export {
  createPipeline,
  CACHE_THRESHOLD,
  LlmOffline,
  LlmRefused,
  OFFLINE_REPLY,
  type Llm,
  type Pipeline,
  type PipelineEnv,
  type PipelineReply,
  type Tier,
} from "./pipeline";
export {
  CACHE_MAX_ENTRIES,
  cleanupCache,
  invalidateCacheByFact,
  isCacheable,
  keyNumbers,
  numbersMatch,
  type CacheHit,
  type CacheStore,
} from "./cache";
export { FACTS, factRef, topFacts, type Fact } from "./facts";
export { CACHE_PAIRS, NEGATIVE_PHRASES, ROUTING_CASES } from "./eval-cases";
export { dot, normalize } from "./vector";
