import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CACHE_PAIRS,
  createRouter,
  INTENTS,
  NEGATIVE_PHRASES,
  normalize,
  ROUTING_CASES,
} from "@kkingg/assistant";
import { loadModelEmbedder, MODEL_THRESHOLD, modelPresent } from "./offline-assistant";

// Runs only when the real model is on disk (the "Model check" workflow downloads it). It loads the model exactly as the
// server does and measures how well the 0.72 / 0.90 thresholds separate right from wrong, then reports the numbers.
describe.skipIf(!modelPresent())("real embedding model", () => {
  it("loads offline, routes the labelled phrases, and reports threshold calibration", async () => {
    const embedder = await loadModelEmbedder();
    expect(embedder, "the model files exist but did not load").not.toBeNull();
    const e = embedder!;
    const [probe] = await e.embed(["hello"]);
    expect(probe!.length).toBe(384);

    const router = await createRouter(INTENTS, e, { threshold: 0 }); // threshold 0: always return the best match
    const rows: string[] = [];
    let right = 0;
    const rightScores: number[] = [];
    for (const [text, want] of ROUTING_CASES) {
      const hit = await router.route(text);
      const got = hit.matched ? hit.id : null;
      const score = hit.matched ? hit.score : (hit.best?.score ?? 0);
      if (got === want) {
        right++;
        rightScores.push(score);
      }
      rows.push(
        `| ${text} | ${want} | ${got ?? "-"} | ${score.toFixed(3)} | ${got === want ? "ok" : "WRONG"} |`,
      );
    }
    const negScores: number[] = [];
    const negRows: string[] = [];
    for (const text of NEGATIVE_PHRASES) {
      const hit = await router.route(text);
      const score = hit.matched ? hit.score : (hit.best?.score ?? 0);
      negScores.push(score);
      negRows.push(
        `| ${text} | ${hit.matched ? hit.id : "-"} | ${score.toFixed(3)} | ${score >= MODEL_THRESHOLD ? "WOULD RUN A COMMAND" : "rejected"} |`,
      );
    }

    const cacheRows: string[] = [];
    const same: number[] = [];
    const diff: number[] = [];
    for (const [a, b, shouldMatch] of CACHE_PAIRS) {
      const [va, vb] = (await e.embed([a, b])).map((v) => normalize(v));
      const sim = va!.reduce((s, x, i) => s + x * vb![i]!, 0);
      (shouldMatch ? same : diff).push(sim);
      cacheRows.push(
        `| ${a} | ${b} | ${shouldMatch ? "same answer" : "different"} | ${sim.toFixed(3)} | ${sim >= 0.9 === shouldMatch ? "ok" : "WRONG at 0.90"} |`,
      );
    }

    const minRight = Math.min(...rightScores);
    const maxNeg = Math.max(...negScores);
    const report = [
      `## Real model check (${e.name})`,
      ``,
      `Routing accuracy (top match): ${right}/${ROUTING_CASES.length}`,
      `Lowest correct score: ${minRight.toFixed(3)}; highest score of a message that must NOT run a command: ${maxNeg.toFixed(3)}`,
      maxNeg < minRight
        ? `A threshold between ${maxNeg.toFixed(3)} and ${minRight.toFixed(3)} separates them (current: ${MODEL_THRESHOLD}).`
        : `No single threshold separates them cleanly (current: ${MODEL_THRESHOLD}); expect some errors.`,
      `Tier 2: lowest same-answer similarity ${Math.min(...same).toFixed(3)}, highest different-answer similarity ${Math.max(...diff).toFixed(3)} (current threshold 0.90).`,
      ``,
      `### Commands`,
      `| phrase | wanted | got | score | |`,
      `|---|---|---|---|---|`,
      ...rows,
      ``,
      `### Must not run a command`,
      `| phrase | best command | score | at ${MODEL_THRESHOLD} |`,
      `|---|---|---|---|`,
      ...negRows,
      ``,
      `### Cache pairs`,
      `| a | b | expected | similarity | |`,
      `|---|---|---|---|---|`,
      ...cacheRows,
    ].join("\n");
    console.log(report);
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");

    expect(right / ROUTING_CASES.length).toBeGreaterThanOrEqual(0.8);
  }, 300_000);
});
