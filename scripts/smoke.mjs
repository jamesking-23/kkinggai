// Unauthenticated smoke test against a locally started production build (`pnpm --filter @kkingg/web start`).
// Checks that every app route redirects to /login without a session, that the public pages render, and that the page
// logs no console errors. It does NOT sign in, so it says nothing about signed-in behaviour.
// Needs Playwright (preinstalled in the dev sandbox; otherwise `npm i -g playwright`) and NODE_PATH pointing at it.
import { createRequire } from "node:module";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ROOT = new URL("../apps/web/app", import.meta.url).pathname;

function pages(dir, url = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      const seg = /^\(.*\)$/.test(name) ? "" : `/${name}`;
      out.push(...pages(p, url + seg));
    } else if (name === "page.tsx") out.push(url || "/");
  }
  return out;
}
const sample = (r) =>
  r
    .replace("[id]", "00000000-0000-0000-0000-000000000000")
    .replace("[code]", "0123456789abcdef0123456789abcdef");
const PUBLIC = ["/login", "/register", "/forgot-password", "/reset-password"];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

let failed = 0;
const routes = pages(ROOT).sort();
for (const route of routes) {
  const url = sample(route);
  const res = await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  const final = new URL(page.url()).pathname;
  const isPublic = PUBLIC.includes(route);
  const ok = isPublic ? final === url && res.status() < 400 : final === "/login";
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${route} -> ${final} (${res.status()})`);
}
console.log(`\n${routes.length} routes checked, ${failed} failed, ${errors.length} console errors`);
for (const e of errors) console.log("  console error:", e.slice(0, 200));
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
