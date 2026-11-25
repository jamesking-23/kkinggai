/* eslint-disable */
// Downloads the local embedding model into ./app_models so the assistant never needs the internet at run time:
// Xenova/bge-small-en-v1.5 (quantised ONNX, about 33 MB, MIT licence), plus the onnxruntime WASM files used for
// `env.backends.onnx.wasm.wasmPaths`. Run before building (`pnpm build` does it). Existing files are kept.
// If the download fails the build carries on (the assistant falls back to its built-in n-gram matcher) unless
// REQUIRE_MODEL=1, which makes a missing model a hard error.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(process.cwd(), "app_models");
const DIR = path.join(ROOT, "Xenova", "bge-small-en-v1.5");
const BASE = "https://huggingface.co/Xenova/bge-small-en-v1.5/resolve/main/";
const FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx",
];
const WASM = ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"];
const required = process.env.REQUIRE_MODEL === "1";

function copyWasm() {
  // (require.resolve cannot be used: the package's "exports" map hides package.json.)
  const from = path.join(process.cwd(), "node_modules", "@huggingface", "transformers");
  const dest = path.join(ROOT, "wasm");
  fs.mkdirSync(dest, { recursive: true });
  for (const f of WASM) {
    const src = path.join(from, "dist", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, f));
  }
}

async function main() {
  for (const f of FILES) {
    const dest = path.join(DIR, f);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const res = await fetch(BASE + f, { signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(f + ": HTTP " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(f + ": empty download");
    fs.writeFileSync(dest + ".part", buf);
    fs.renameSync(dest + ".part", dest);
    console.log("downloaded " + f + " (" + Math.round(buf.length / 1024) + " KB)");
  }
  copyWasm();
  console.log("model ready in " + DIR);
}

main().catch((e) => {
  const msg = "Model download failed: " + (e && e.message ? e.message : e);
  if (required) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(
    msg +
      "\nContinuing: the assistant will use its built-in n-gram matcher until the model is present.",
  );
  try {
    copyWasm();
  } catch (_) {}
});
