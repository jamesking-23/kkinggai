import { describe, expect, it } from "vitest";
import {
  analyseMoves,
  barPercent,
  classifyLoss,
  formatScore,
  parseInfo,
  summarise,
  whiteCp,
} from "./analysis";

describe("parseInfo", () => {
  it("reads depth, centipawn score and pv", () => {
    const r = parseInfo(
      "info depth 12 seldepth 17 multipv 1 score cp -34 nodes 23297 nps 235323 hashfull 10 time 99 pv e7e5 g1f3 b8c6",
    );
    expect(r).toEqual({ depth: 12, score: { cp: -34 }, pv: ["e7e5", "g1f3", "b8c6"] });
  });
  it("reads mate scores", () => {
    expect(parseInfo("info depth 5 multipv 1 score mate 3 pv a1a2")?.score).toEqual({ mate: 3 });
  });
  it("ignores other lines, later MultiPV lines and bound-only noise without a score", () => {
    expect(parseInfo("bestmove e7e5")).toBeNull();
    expect(parseInfo("info string NNUE evaluation using nn.bin")).toBeNull();
    expect(parseInfo("info depth 3 multipv 2 score cp 10 pv a2a3")).toBeNull();
    expect(parseInfo("info depth 3 currmove e2e4 currmovenumber 1")).toBeNull();
  });
});

describe("score conversion", () => {
  it("flips sign for black to move", () => {
    expect(whiteCp({ cp: 50 }, "w")).toBe(50);
    expect(whiteCp({ cp: 50 }, "b")).toBe(-50);
  });
  it("maps mate scores", () => {
    expect(whiteCp({ mate: 2 }, "w")).toBe(9998);
    expect(whiteCp({ mate: 2 }, "b")).toBe(-9998);
    expect(whiteCp({ mate: -1 }, "w")).toBe(-9999);
    expect(whiteCp({ mate: 0 }, "w")).toBe(-10000);
  });
  it("formats and bars", () => {
    expect(formatScore(34)).toBe("+0.34");
    expect(formatScore(-120)).toBe("-1.20");
    expect(formatScore(0)).toBe("0.00");
    expect(formatScore(9997)).toBe("M3");
    expect(formatScore(-9997)).toBe("-M3");
    expect(barPercent(0)).toBe(50);
    expect(barPercent(1000)).toBeGreaterThan(80);
    expect(barPercent(-1000)).toBeLessThan(20);
  });
});

describe("classification", () => {
  it("uses fixed thresholds", () => {
    expect(classifyLoss(0)).toBe("good");
    expect(classifyLoss(29)).toBe("good");
    expect(classifyLoss(30)).toBe("inaccuracy");
    expect(classifyLoss(80)).toBe("mistake");
    expect(classifyLoss(200)).toBe("blunder");
  });
  it("scores each move from the mover's side and credits engine moves", () => {
    // start 0, white plays best (+20), black blunders (eval rises to +400), white drops 300 back to +100
    const moves = analyseMoves(
      [0, 20, 400, 100],
      ["e2e4", "e7e5", "g1f3"],
      ["e2e4", "a7a6", "g1h3"],
    );
    expect(moves.map((m) => m.cls)).toEqual(["best", "blunder", "blunder"]);
    expect(moves[1]!.loss).toBe(380);
    expect(moves[2]!.loss).toBe(300);
  });
  it("never reports a negative loss and clamps huge swings", () => {
    const m = analyseMoves([0, 50, 9990], [null, null], ["a2a3", "a7a6"]);
    expect(m[0]!.loss).toBe(0);
    expect(m[1]!.loss).toBe(950);
  });
  it("summarises per side", () => {
    const s = summarise(
      analyseMoves([0, 20, 400, 100], ["e2e4", "e7e5", "g1f3"], ["e2e4", "a7a6", "g1h3"]),
    );
    expect(s.white).toMatchObject({ moves: 2, best: 1, blunder: 1, averageLoss: 150 });
    expect(s.black).toMatchObject({ moves: 1, blunder: 1, averageLoss: 380 });
    expect(summarise([]).white.averageLoss).toBeNull();
  });
});
