// Downloads the local embedding model (BAAI/bge-small-en-v1.5, quantised ONNX, ~33 MB, MIT) into ./app_models so the
// assistant never needs the network at run time. Run before building: `pnpm --filter @kkingg/web download-model`.
// Skips files that already exist. If the download fails the build carries on (the assistant falls back to its built-in
// n-gram matcher) unless REQUIRE_MODEL=1, which makes a missing model a hard error.
/* global fetch, AbortSignal */
import fs from "node:fs";
import process from "node:process";
import { Buffer } from "node:buffer";
import path from "node:path";

const REPO = "Qdrant/bge-small-en-v1.5-onnx-Q";
const DIR = path.join(process.cwd(), "app_models", "Qdrant_bge-small-en-v1.5-onnx-Q");
const FILES = [
  "model_optimized.onnx",
  "tokenizer.json",
  "config.json",
  "special_tokens_map.json",
  "tokenizer_config.json",
];
const required = process.env.REQUIRE_MODEL === "1";

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of FILES) {
    const dest = path.join(DIR, f);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
    const res = await fetch(`https://huggingface.co/${REPO}/resolve/main/${f}`, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(`${f}: empty download`);
    fs.writeFileSync(dest + ".part", buf);
    fs.renameSync(dest + ".part", dest);
    console.log(`downloaded ${f} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  console.log(`model ready in ${DIR}`);
}

main().catch((e) => {
  const msg = `Model download failed: ${e instanceof Error ? e.message : e}`;
  if (required) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(
    `${msg}\nContinuing: the assistant will use its built-in n-gram matcher until the model is present.`,
  );
});
