import { describe, expect, it } from "vitest";
import {
  buildRepertoire,
  drillPositions,
  formatPath,
  positionKey,
  scorePercent,
} from "./chessRepertoire";

const g = (pgn: string, user_color: string | null, result: string) => ({
  pgn,
  user_color,
  result,
});

describe("repertoire", () => {
  it("formats paths and scores", () => {
    expect(formatPath([])).toBe("Starting position");
    expect(formatPath(["e4", "c5", "Nf3"])).toBe("1. e4 c5 2. Nf3");
    expect(scorePercent({ wins: 1, draws: 2, losses: 1 })).toBe(50);
    expect(scorePercent({ wins: 0, draws: 0, losses: 0 })).toBeNull();
  });

  it("drops move counters from the key", () => {
    expect(positionKey("a b c d 5 9")).toBe("a b c d");
  });

  it("needs two games, counts moves and scores them", () => {
    const games = [
      g("1. e4 e5 2. Nf3 Nc6 *", "white", "1-0"),
      g("1. e4 c5 2. Nf3 d6 *", "white", "0-1"),
      g("1. d4 d5 *", "white", "1/2-1/2"),
      g("1. e4 e5 *", null, "1-0"),
      g("not a pgn ###", "white", "1-0"),
    ];
    const reps = buildRepertoire(games);
    const start = reps.find((p) => p.path.length === 0)!;
    expect(start.total).toBe(3);
    expect(start.moves[0]).toMatchObject({ san: "e4", count: 2, wins: 1, losses: 1 });
    expect(reps.every((p) => p.total >= 2)).toBe(true);
    expect(drillPositions(reps).map((p) => p.path.length)).toContain(0);
  });

  it("only keeps positions where it was your turn", () => {
    const games = [g("1. e4 e5 2. Nf3 *", "black", "0-1"), g("1. e4 e5 2. Nf3 *", "black", "1-0")];
    const reps = buildRepertoire(games);
    expect(reps.every((p) => p.color === "black" && p.path.length % 2 === 1)).toBe(true);
  });
});
