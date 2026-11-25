import fs from "node:fs";
import path from "node:path";
import { providerFromEnv, type ChatProvider } from "@kkingg/ai";
import { createAssistant, ngramEmbedder, type Assistant, type Embedder } from "@kkingg/assistant";

export const MODEL_NAME = "BAAI/bge-small-en-v1.5";
export const MODEL_DIR_NAME = "Qdrant_bge-small-en-v1.5-onnx-Q";
export const MODEL_FILES = [
  "model_optimized.onnx",
  "tokenizer.json",
  "config.json",
  "special_tokens_map.json",
  "tokenizer_config.json",
] as const;

/** Where the model lives: ./app_models next to the app. Never downloaded at runtime. */
export function modelDir(cwd: string = process.cwd()): string {
  return path.join(cwd, "app_models", MODEL_DIR_NAME);
}

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
 * Loads the local bge-small embedder from disk. It only reads files that already exist (the download script puts them
 * there at build time) and never touches the network. Returns null when the files are missing or fail to load.
 */
async function loadModelEmbedder(dir: string): Promise<Embedder | null> {
  if (!modelPresent(dir)) return null;
  try {
    const { FlagEmbedding, EmbeddingModel, Pooling } = await import("fastembed");
    const model = await FlagEmbedding.init({
      model: EmbeddingModel.CUSTOM,
      modelAbsoluteDirPath: dir,
      modelName: "model_optimized.onnx",
      pooling: Pooling.CLS,
      showDownloadProgress: false,
    });
    return {
      name: MODEL_NAME,
      defaultThreshold: 0.65,
      async embed(texts) {
        const out: Float32Array[] = [];
        for await (const batch of model.embed(texts, 32))
          for (const v of batch) out.push(Float32Array.from(v));
        return out;
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

let cached: Promise<Assistant> | null = null;

/**
 * One router per server process: embeds every example phrase once, then each message costs one embedding plus a few
 * dot products. If the model files are not present it degrades to the built-in n-gram embedder (weaker on rephrasings,
 * still fully offline) and says so through `embedderName`.
 */
export function getOfflineAssistant(): Promise<Assistant> {
  if (!cached) {
    cached = (async () => {
      const model = await loadModelEmbedder(modelDir());
      const embedder = model ?? ngramEmbedder();
      return createAssistant({ embedder, threshold: thresholdFromEnv(process.env) });
    })().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

/** Cloud chat is off unless a provider key is set AND this flag is explicitly on. */
export function cloudFallbackEnabled(env: Record<string, string | undefined>): boolean {
  return env.ASSISTANT_CLOUD_FALLBACK === "1";
}

/** The optional cloud provider: null (fully offline) unless a key is set AND ASSISTANT_CLOUD_FALLBACK=1. */
export function cloudProvider(env: Record<string, string | undefined>): ChatProvider | null {
  return cloudFallbackEnabled(env) ? providerFromEnv(env) : null;
}
