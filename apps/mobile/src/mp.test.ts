import { describe, expect, it } from "vitest";
import {
  clocksAt,
  extractInviteCode,
  formatClock,
  promotionPieces,
  replayMoves,
  sideOf,
  summarise,
  uciFor,
} from "./mp";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const game = (over: object = {}) => ({
  status: "active",
  moves: [] as string[],
  white_id: "w",
  black_id: "b",
  resigned_by: null,
  ...over,
});

describe("mp", () => {
  it("replays moves and detects checkmate (fool's mate)", () => {
    const rep = replayMoves(["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(rep.ok && rep.over?.result).toBe("0-1");
    expect(summarise(game({ moves: ["f2f3", "e7e5", "g2g4", "d8h4"] }), rep).text).toMatch(
      /Checkmate\. Black wins/,
    );
  });
  it("rejects an illegal move list", () => {
    expect(replayMoves(["e2e5"]).ok).toBe(false);
  });
  it("tells which side the viewer plays", () => {
    expect(sideOf(game(), "w")).toBe("white");
    expect(sideOf(game(), "b")).toBe("black");
    expect(sideOf(game(), "x")).toBeNull();
  });
  it("runs the clock of the side to move only after both have moved", () => {
    const g = {
      status: "active",
      moves: ["e2e4", "e7e5", "g1f3"],
      clock_seconds: 300,
      white_ms: 300000,
      black_ms: 290000,
      clock_started_at: "2026-01-01T00:00:00Z",
    };
    const c = clocksAt(g, Date.parse("2026-01-01T00:00:05Z"))!;
    expect(c.running).toBe("b");
    expect(c.blackMs).toBe(285000);
    expect(c.whiteMs).toBe(300000);
    expect(clocksAt({ ...g, clock_seconds: null }, 0)).toBeNull();
  });
  it("formats clocks", () => {
    expect(formatClock(245000)).toBe("4:05");
    expect(formatClock(7300)).toBe("0:07.3");
  });
  it("extracts an invite code from a link or bare code", () => {
    const code = "0123456789abcdef0123456789ABCDEF";
    expect(extractInviteCode(`https://kkingg-ai.vercel.app/chess/play/join/${code}`)).toBe(
      code.toLowerCase(),
    );
    expect(extractInviteCode(code)).toBe(code.toLowerCase());
    expect(extractInviteCode("hello")).toBeNull();
  });
  it("handles promotion choices", () => {
    const fen = "8/P7/8/8/8/8/8/k6K w - - 0 1";
    expect(promotionPieces(fen, "a7", "a8").sort()).toEqual(["b", "n", "q", "r"]);
    expect(promotionPieces(START, "e2", "e4")).toEqual([]);
    expect(uciFor(fen, "a7", "a8", "n")).toBe("a7a8n");
    expect(uciFor(START, "e2", "e4")).toBe("e2e4");
    expect(uciFor(START, "e2", "e5")).toBeNull();
  });
});
