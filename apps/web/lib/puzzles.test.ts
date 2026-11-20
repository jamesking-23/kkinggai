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

describe("promotion helpers", () => {
  const PROMO = "8/P7/8/8/8/8/k6K/8 w - - 0 1";
  it("lists the four promotion pieces, queen first", async () => {
    const { promotionChoices } = await import("./puzzles");
    expect(promotionChoices(PROMO, "a7", "a8")).toEqual(["q", "r", "b", "n"]);
  });
  it("lists nothing for an ordinary or illegal move", async () => {
    const { promotionChoices } = await import("./puzzles");
    expect(promotionChoices(PROMO, "h2", "h3")).toEqual([]);
    expect(promotionChoices(PROMO, "a7", "a6")).toEqual([]);
    expect(promotionChoices("nonsense", "a7", "a8")).toEqual([]);
  });
  it("builds the move with the chosen piece", async () => {
    const { moveWith } = await import("./puzzles");
    expect(moveWith(PROMO, "a7", "a8", "n")?.uci).toBe("a7a8n");
    expect(moveWith(PROMO, "a7", "a8", "r")?.uci).toBe("a7a8r");
    expect(moveWith(PROMO, "a7", "a8")).toBeNull(); // a promotion needs a piece
    expect(moveWith(PROMO, "h2", "h3")?.uci).toBe("h2h3");
    expect(moveWith(PROMO, "a7", "b8", "q")).toBeNull();
  });
});
