// Copies the single-threaded "lite" Stockfish build from node_modules into public/engine so the browser can load it
// as a Web Worker. Runs before dev and build. The files are not committed (see .gitignore).
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("stockfish/package.json"));
const out = new URL("../public/engine/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const f of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm", "Copying.txt"]) {
  const src = join(pkgDir, f.endsWith(".txt") ? f : `bin/${f}`);
  if (!existsSync(src)) throw new Error(`Missing engine file: ${src}`);
  copyFileSync(src, join(out, f));
}
console.log("Copied Stockfish engine to public/engine");
