import { describe, expect, it } from "vitest";
import {
  buildRepertoire,
  drillPositions,
  formatPath,
  positionKey,
  scorePercent,
} from "./repertoire";

const g = (pgn: string, user_color: string | null, result: string) => ({ pgn, user_color, result });

describe("buildRepertoire", () => {
  const games = [
    g("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0", "white", "1-0"),
    g("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 0-1", "white", "0-1"),
    g("1. e4 c5 2. Nf3 d6 1/2-1/2", "white", "1/2-1/2"),
    g("1. d4 d5 2. c4 e6 *", "white", "*"),
  ];
  it("finds the start position with all first moves and their results", () => {
    const rep = buildRepertoire(games);
    const start = rep.find((p) => p.path.length === 0)!;
    expect(start.total).toBe(4);
    const e4 = start.moves.find((m) => m.san === "e4")!;
    expect(e4).toMatchObject({ count: 3, wins: 1, losses: 1, draws: 1 });
    const d4 = start.moves.find((m) => m.san === "d4")!;
    expect(d4).toMatchObject({ count: 1, wins: 0, draws: 0, losses: 0 }); // unfinished game: counted, not scored
    expect(start.moves[0]!.san).toBe("e4"); // most played first
  });
  it("only keeps positions reached in enough games, and only the user's turns", () => {
    const rep = buildRepertoire(games);
    expect(rep.every((p) => p.total >= 2)).toBe(true);
    // after 1. e4 e5 it is white's move again: reached twice
    expect(rep.some((p) => p.path.join(" ") === "e4 e5")).toBe(true);
    // black's replies are not part of a white repertoire
    expect(rep.some((p) => p.path.join(" ") === "e4")).toBe(false);
    expect(rep.every((p) => p.color === "white")).toBe(true);
  });
  it("branches where the games diverge", () => {
    const rep = buildRepertoire(games);
    const afterNc6 = rep.find((p) => p.path.join(" ") === "e4 e5 Nf3 Nc6")!;
    expect(afterNc6.moves.map((m) => m.san).sort()).toEqual(["Bb5", "Bc4"]);
  });
  it("handles the user's black games by their own turns", () => {
    const rep = buildRepertoire(
      [g("1. e4 c5 2. Nf3 d6 1-0", "black", "1-0"), g("1. e4 c5 2. Nc3 Nc6 0-1", "black", "0-1")],
      16,
      2,
    );
    const afterE4 = rep.find((p) => p.path.join(" ") === "e4")!;
    expect(afterE4.color).toBe("black");
    expect(afterE4.moves[0]).toMatchObject({ san: "c5", count: 2, wins: 1, losses: 1 });
  });
  it("merges transpositions and respects the depth limit", () => {
    const rep = buildRepertoire(
      [
        g("1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 1-0", "white", "1-0"),
        g("1. c4 e6 2. d4 Nf6 3. Nc3 Bb4 1-0", "white", "1-0"),
      ],
      6,
      2,
    );
    // both games reach the same position (after d4 Nf6 c4 e6 / c4 e6 d4 Nf6) with white to move
    const merged = rep.find((p) => p.moves.some((m) => m.san === "Nc3"));
    expect(merged?.total).toBe(2);
    expect(
      buildRepertoire(
        [
          g("1. e4 e5 2. Nf3 Nc6 1-0", "white", "1-0"),
          g("1. e4 e5 2. Nf3 Nc6 1-0", "white", "1-0"),
        ],
        2,
        2,
      ).every((p) => p.path.length < 2),
    ).toBe(true);
  });
  it("skips games without a side or with a bad PGN", () => {
    expect(buildRepertoire([g("1. e4 e5 1-0", null, "1-0"), g("garbage", "white", "1-0")])).toEqual(
      [],
    );
  });
});

describe("helpers", () => {
  it("positionKey drops the move counters", () => {
    expect(positionKey("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
    );
  });
  it("formatPath numbers white's moves", () => {
    expect(formatPath([])).toBe("Starting position");
    expect(formatPath(["e4", "c5", "Nf3"])).toBe("1. e4 c5 2. Nf3");
  });
  it("scorePercent counts a draw as half and ignores unfinished games", () => {
    expect(scorePercent({ wins: 1, draws: 1, losses: 0 })).toBe(75);
    expect(scorePercent({ wins: 0, draws: 0, losses: 0 })).toBeNull();
  });
  it("drillPositions needs a clear main move", () => {
    const rep = buildRepertoire([
      g("1. e4 e5 1-0", "white", "1-0"),
      g("1. e4 e5 1-0", "white", "1-0"),
      g("1. d4 d5 1-0", "white", "1-0"),
    ]);
    const start = rep.find((p) => p.path.length === 0)!;
    expect(start.moves[0]!.count / start.total).toBeCloseTo(2 / 3);
    expect(drillPositions(rep).some((p) => p.path.length === 0)).toBe(true);
  });
});
