import { describe, expect, it } from "vitest";
import {
  fenToLetters,
  glyph,
  isWhitePiece,
  legalTargets,
  nextSchedule,
  orient,
  ownsSquare,
  resolveClick,
  sanForUci,
  squareAt,
} from "./chessPuzzles";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PROMO = "8/P6k/8/8/8/8/8/K7 w - - 0 1"; // a7 pawn can promote on a8

describe("chess puzzle helpers", () => {
  it("schedules reviews", () => {
    const now = new Date("2026-11-23T10:00:00Z");
    expect(nextSchedule(0, false, now).dueAt.toISOString()).toBe("2026-11-23T10:10:00.000Z");
    expect(nextSchedule(5, false, now).box).toBe(0);
    expect(nextSchedule(0, true, now)).toMatchObject({ box: 1 });
    expect(nextSchedule(0, true, now).dueAt.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(nextSchedule(5, true, now).box).toBe(5);
    expect(nextSchedule(-3, true, now).box).toBe(1);
  });
  it("reads a FEN into a grid", () => {
    const g = fenToLetters(START);
    expect(g).toHaveLength(8);
    expect(g[0]).toEqual(["r", "n", "b", "q", "k", "b", "n", "r"]);
    expect(g[7]![4]).toBe("K");
    expect(g[3]).toEqual(Array(8).fill(""));
    expect(fenToLetters("8/8/8/8/8/8/8/8 w - - 0 1")[0]).toEqual(Array(8).fill(""));
  });
  it("maps glyphs and colours", () => {
    expect(glyph("K")).toBe("♚");
    expect(glyph("p")).toBe("♟");
    expect(glyph("")).toBe("");
    expect(isWhitePiece("Q")).toBe(true);
    expect(isWhitePiece("q")).toBe(false);
    expect(isWhitePiece("")).toBe(false);
  });
  it("names squares for either orientation", () => {
    expect(squareAt(0, 0, false)).toBe("a8");
    expect(squareAt(7, 7, false)).toBe("h1");
    expect(squareAt(0, 0, true)).toBe("h1");
    expect(squareAt(7, 7, true)).toBe("a8");
    const flipped = orient(fenToLetters(START), true);
    expect(flipped[0]![0]).toBe("R"); // white rook h1 at top-left when flipped
    expect(squareAt(0, 0, true)).toBe("h1");
  });
  it("plays and checks moves", () => {
    expect(sanForUci(START, "e2e4")).toBe("e4");
    expect(sanForUci(START, "e2e5")).toBeNull();
    expect(sanForUci("garbage", "e2e4")).toBeNull();
    expect(resolveClick(START, "e2", "e4", "e2e4")).toEqual({ uci: "e2e4", san: "e4" });
    expect(resolveClick(START, "e2", "e5", "e2e4")).toBeNull();
    expect(resolveClick("garbage", "e2", "e4", "e2e4")).toBeNull();
  });
  it("picks the promotion from the solution, defaulting to queen", () => {
    expect(resolveClick(PROMO, "a7", "a8", "a7a8n")?.uci).toBe("a7a8n");
    expect(resolveClick(PROMO, "a7", "a8", "a1a2")?.uci).toBe("a7a8q");
  });
  it("lists legal targets and ownership", () => {
    expect([...legalTargets(START, "e2")].sort()).toEqual(["e3", "e4"]);
    expect(legalTargets(START, "e5").size).toBe(0);
    expect(legalTargets("garbage", "e2").size).toBe(0);
    expect(ownsSquare(START, "e2", "white")).toBe(true);
    expect(ownsSquare(START, "e7", "white")).toBe(false);
    expect(ownsSquare(START, "e4", "white")).toBe(false);
  });
});
