import { describe, expect, it } from "vitest";
import { nextSchedule, resolveClick, sanForUci } from "./puzzles";

const NOW = new Date("2026-11-12T00:00:00Z");
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("nextSchedule", () => {
  it("moves up a box and waits longer each time", () => {
    expect(nextSchedule(0, true, NOW)).toEqual({ box: 1, dueAt: new Date("2026-11-13T00:00:00Z") });
    expect(nextSchedule(2, true, NOW).dueAt).toEqual(new Date("2026-11-19T00:00:00Z"));
  });
  it("stops at box 5 (30 days)", () => {
    expect(nextSchedule(5, true, NOW)).toEqual({ box: 5, dueAt: new Date("2026-12-12T00:00:00Z") });
  });
  it("resets to box 0 and retries in 10 minutes after a miss", () => {
    expect(nextSchedule(4, false, NOW)).toEqual({
      box: 0,
      dueAt: new Date("2026-11-12T00:10:00Z"),
    });
  });
});

describe("sanForUci / resolveClick", () => {
  it("converts legal moves and rejects illegal ones", () => {
    expect(sanForUci(START, "e2e4")).toBe("e4");
    expect(sanForUci(START, "e2e5")).toBeNull();
    expect(sanForUci("not a fen", "e2e4")).toBeNull();
  });
  it("resolves a click to a legal move", () => {
    expect(resolveClick(START, "g1", "f3", "g1f3")).toEqual({ uci: "g1f3", san: "Nf3" });
    expect(resolveClick(START, "e2", "e5", "e2e4")).toBeNull();
  });
  it("picks the solution's promotion piece, else a queen", () => {
    const fen = "8/P7/8/8/8/8/k6K/8 w - - 0 1";
    expect(resolveClick(fen, "a7", "a8", "a7a8n")?.uci).toBe("a7a8n");
    expect(resolveClick(fen, "a7", "a8", "h2g3")?.uci).toBe("a7a8q");
  });
});
