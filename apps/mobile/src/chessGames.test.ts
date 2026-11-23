import { describe, expect, it } from "vitest";
import {
  clampPly,
  filterGames,
  gameTitle,
  lastMove,
  movePairs,
  outcomeFor,
  replay,
  resultLabel,
} from "./chessGames";

const PGN = '[Event "t"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0';
const g = (over: Record<string, unknown>) => ({
  white: "Me",
  black: "Bob",
  opening: null as string | null,
  result: "1-0",
  user_color: "white" as "white" | "black" | null,
  ...over,
});

describe("chess game helpers", () => {
  it("replays a PGN into positions", () => {
    const r = replay(PGN)!;
    expect(r.sans).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
    expect(r.ucis[0]).toBe("e2e4");
    expect(r.fens).toHaveLength(7);
    expect(r.fens[0]).toContain("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  });
  it("returns null for an invalid PGN", () => {
    expect(replay("1. e4 e4 e4 zzz")).toBeNull();
  });
  it("works out your outcome", () => {
    expect(outcomeFor({ result: "1-0", user_color: "white" })).toBe("win");
    expect(outcomeFor({ result: "1-0", user_color: "black" })).toBe("loss");
    expect(outcomeFor({ result: "0-1", user_color: "black" })).toBe("win");
    expect(outcomeFor({ result: "1/2-1/2", user_color: "black" })).toBe("draw");
    expect(outcomeFor({ result: "*", user_color: "white" })).toBeNull();
    expect(outcomeFor({ result: "1-0", user_color: null })).toBeNull();
  });
  it("titles and labels", () => {
    expect(gameTitle({ white: "Me", black: "Bob", user_color: "white" })).toBe("You vs Bob");
    expect(gameTitle({ white: "Al", black: "Me", user_color: "black" })).toBe("You vs Al");
    expect(gameTitle({ white: "Al", black: "Bo", user_color: null })).toBe("Al vs Bo");
    expect(resultLabel({ result: "1-0", user_color: "black" })).toBe("Loss");
    expect(resultLabel({ result: "*", user_color: "white" })).toBe("Unfinished");
    expect(resultLabel({ result: "1-0", user_color: null })).toBe("1-0");
  });
  it("pairs moves", () => {
    expect(movePairs(["e4", "e5", "Nf3"])).toEqual([
      { n: 1, white: "e4", black: "e5", whitePly: 1 },
      { n: 2, white: "Nf3", black: null, whitePly: 3 },
    ]);
    expect(movePairs([])).toEqual([]);
  });
  it("clamps positions and finds the last move", () => {
    expect(clampPly(-3, 6)).toBe(0);
    expect(clampPly(99, 6)).toBe(6);
    expect(clampPly(2.9, 6)).toBe(2);
    expect(clampPly(NaN, 6)).toBe(0);
    expect(lastMove(["e2e4", "e7e5"], 0)).toBeNull();
    expect(lastMove(["e2e4", "e7e5"], 2)).toEqual({ from: "e7", to: "e5" });
  });
  it("filters by outcome and text", () => {
    const list = [g({}), g({ result: "0-1", black: "Zed", opening: "Sicilian" })];
    expect(filterGames(list, "all", "")).toHaveLength(2);
    expect(filterGames(list, "win", "")).toHaveLength(1);
    expect(filterGames(list, "loss", "sicil")).toHaveLength(1);
    expect(filterGames(list, "all", "ZED")).toHaveLength(1);
    expect(filterGames(list, "draw", "")).toHaveLength(0);
  });
});
