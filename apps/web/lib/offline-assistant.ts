import fs from "node:fs";
import path from "node:path";
import { DEFAULT_GEMINI_MODEL, geminiProvider, type ChatProvider } from "@kkingg/ai";
import { createPipeline, ngramEmbedder, type Embedder, type Pipeline } from "@kkingg/assistant";
import { responseCacheStore } from "./response-cache";

export const MODEL_ID = "Xenova/bge-small-en-v1.5";
/** Tier 1 accepts a command at or above this similarity with the local model. */
export const MODEL_THRESHOLD = 0.72;
export const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx",
] as const;
export const WASM_FILES = ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"];

/** Everything the model needs lives in ./app_models. Nothing is ever fetched from the internet at run time. */
export const modelsRoot = (cwd: string = process.cwd()) => path.join(cwd, "app_models");
export const modelDir = (cwd?: string) => path.join(modelsRoot(cwd), ...MODEL_ID.split("/"));

export function modelPresent(dir: string = modelDir()): boolean {
  return MODEL_FILES.every((f) => {
    try {
      return fs.statSync(path.join(dir, f)).size > 0;
    } catch {
      return false;
    }
  });
}

/**
 * Loads the quantised bge-small model through @huggingface/transformers, strictly from disk
 * (`allowRemoteModels = false`). Returns null when the files are missing or fail to load.
 */
export async function loadModelEmbedder(): Promise<Embedder | null> {
  if (!modelPresent()) return null;
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = modelsRoot();
    const wasm = path.join(modelsRoot(), "wasm");
    if (fs.existsSync(wasm) && env.backends.onnx.wasm)
      env.backends.onnx.wasm.wasmPaths = `${wasm}${path.sep}`;
    const extractor = await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" });
    return {
      name: MODEL_ID,
      defaultThreshold: MODEL_THRESHOLD,
      async embed(texts) {
        const out = await extractor(texts, { pooling: "cls", normalize: true });
        return (out.tolist() as number[][]).map((v) => Float32Array.from(v));
      },
    };
  } catch {
    return null;
  }
}

export function thresholdFromEnv(env: Record<string, string | undefined>): number | undefined {
  const n = Number(env.OFFLINE_ASSISTANT_THRESHOLD);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : undefined;
}

let cached: Promise<Pipeline> | null = null;

/**
 * One pipeline per server process: it embeds every command phrase and app fact once, then each message costs one
 * embedding plus a few dot products. If the model files are missing it degrades to the built-in n-gram embedder (weaker
 * on rephrasings; the shared cache is skipped because its vectors are for the real model) and keeps working.
 */
export function getPipeline(): Promise<Pipeline> {
  if (!cached) {
    cached = (async () => {
      const model = await loadModelEmbedder();
      return createPipeline({
        embedder: model ?? ngramEmbedder(),
        threshold: thresholdFromEnv(process.env),
        cache: model ? responseCacheStore(process.env) : null,
      });
    })().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

/** Tier 3: Gemini, when GEMINI_API_KEY is set. Without a key the assistant stays fully offline (Tiers 1 and 2). */
export function cloudProvider(env: Record<string, string | undefined>): ChatProvider | null {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return geminiProvider({ apiKey, model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL });
}
