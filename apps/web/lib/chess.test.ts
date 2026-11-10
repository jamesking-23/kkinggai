import { describe, expect, it } from "vitest";
import {
  computeStats,
  detectColor,
  exportPgn,
  outcomeFor,
  parsePgnGame,
  parsePgnGames,
  replay,
  splitPgn,
  winRate,
} from "./chess";
import { fenToBoard } from "./board";
import { classifyOpening } from "./openings";

const G1 = `[Event "Casual"]
[Site "https://lichess.org/abcd1234"]
[Date "2024.05.12"]
[White "Me"]
[Black "Opp"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1480"]
[TimeControl "600+0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 1-0`;

const G2 = `[Event "Club"]
[Date "2024.06.01"]
[White "Opp"]
[Black "Me"]
[Result "0-1"]
[BlackElo "1520"]

1. d4 d5 2. c4 e6 0-1`;

describe("splitPgn", () => {
  it("splits on Event tags and handles CRLF", () => {
    expect(splitPgn(`${G1}\r\n\r\n${G2}`.replace(/\n/g, "\r\n"))).toHaveLength(2);
  });
  it("treats bare movetext as one game and empty text as none", () => {
    expect(splitPgn("1. e4 e5 *")).toHaveLength(1);
    expect(splitPgn("  \n ")).toEqual([]);
  });
});

describe("parsePgnGame", () => {
  it("extracts headers, move count and opening", () => {
    const r = parsePgnGame(G1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.game).toMatchObject({
      white: "Me",
      black: "Opp",
      result: "1-0",
      playedOn: "2024-05-12",
      whiteElo: 1500,
      timeControl: "600+0",
      moveCount: 4,
      opening: "Ruy Lopez",
      eco: "C60",
    });
  });
  it("rejects illegal moves and games without moves", () => {
    expect(parsePgnGame("1. e4 e4 *").ok).toBe(false);
    expect(parsePgnGame('[Event "x"]\n\n*').ok).toBe(false);
  });
  it("drops unknown or partial dates", () => {
    const r = parsePgnGame('[Date "2024.??.??"]\n\n1. e4 e5 *');
    expect(r.ok && r.game.playedOn).toBeNull();
  });
  it("gives the same key for the same game", () => {
    const a = parsePgnGame(G1);
    const b = parsePgnGame(G1 + "\n");
    expect(a.ok && b.ok && a.game.externalId === b.game.externalId).toBe(true);
  });
});

describe("parsePgnGames", () => {
  it("collects valid games, reports bad ones, de-duplicates and respects the limit", () => {
    const bad = '[Event "bad"]\n\n1. e4 e4 *';
    const out = parsePgnGames([G1, bad, G2, G1].join("\n\n"), 10);
    expect(out.games).toHaveLength(2);
    expect(out.errors).toHaveLength(1);
    expect(parsePgnGames([G1, G2].join("\n\n"), 1)).toMatchObject({ truncated: true });
  });
});

describe("detectColor and outcomeFor", () => {
  it("matches names case-insensitively and rejects ambiguity", () => {
    expect(detectColor("Me", "Opp", ["me"])).toBe("white");
    expect(detectColor("Opp", "ME", ["me"])).toBe("black");
    expect(detectColor("A", "B", ["me"])).toBeNull();
    expect(detectColor("me", "me", ["me"])).toBeNull();
  });
  it("scores from the user's side", () => {
    expect(outcomeFor({ result: "1-0", user_color: "white" })).toBe("win");
    expect(outcomeFor({ result: "1-0", user_color: "black" })).toBe("loss");
    expect(outcomeFor({ result: "1/2-1/2", user_color: "black" })).toBe("draw");
    expect(outcomeFor({ result: "*", user_color: "white" })).toBeNull();
    expect(outcomeFor({ result: "1-0", user_color: null })).toBeNull();
  });
});

describe("computeStats", () => {
  const rows = [
    {
      result: "1-0",
      user_color: "white",
      opening: "Ruy Lopez",
      played_on: "2024-05-12",
      white_elo: 1500,
      black_elo: 1480,
    },
    {
      result: "0-1",
      user_color: "black",
      opening: "Queen's Gambit",
      played_on: "2024-06-01",
      white_elo: 1400,
      black_elo: 1520,
    },
    {
      result: "1/2-1/2",
      user_color: "white",
      opening: "Ruy Lopez",
      played_on: "2024-06-02",
      white_elo: 1510,
      black_elo: 1500,
    },
    {
      result: "1-0",
      user_color: null,
      opening: null,
      played_on: null,
      white_elo: null,
      black_elo: null,
    },
  ];
  it("counts only games with a known colour and a result", () => {
    const s = computeStats(rows);
    expect(s.total).toBe(4);
    expect(s.counted).toBe(3);
    expect(s.overall).toEqual({ games: 3, wins: 2, draws: 1, losses: 0 });
    expect(s.white.games).toBe(2);
    expect(s.black.games).toBe(1);
    expect(winRate(s.overall)).toBe(83);
    expect(s.openings[0]).toMatchObject({ name: "Ruy Lopez", games: 2 });
    expect(s.months.map((m) => m.month)).toEqual(["2024-05", "2024-06"]);
    expect(s.ratings.map((r) => r.rating)).toEqual([1500, 1520, 1510]);
  });
  it("handles no games", () => {
    expect(winRate(computeStats([]).overall)).toBeNull();
  });
});

describe("replay, export and board", () => {
  it("returns one more FEN than moves and null for invalid PGN", () => {
    const r = replay(G1);
    expect(r?.sans).toHaveLength(8);
    expect(r?.fens).toHaveLength(9);
    expect(r?.fens[0]).toContain("rnbqkbnr/pppppppp");
    expect(replay("1. e4 e4")).toBeNull();
  });
  it("exports games separated by blank lines", () => {
    const out = exportPgn([{ pgn: G1 }, { pgn: G2 }]);
    expect(splitPgn(out)).toHaveLength(2);
    expect(out.endsWith("\n")).toBe(true);
  });
  it("renders the start position", () => {
    const b = fenToBoard("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(b).toHaveLength(8);
    expect(b.every((row) => row.length === 8)).toBe(true);
    expect(b[0]![0]).toBe("♜");
    expect(b[4]!.every((c) => c === "")).toBe(true);
  });
});

describe("classifyOpening", () => {
  it("uses the longest matching prefix", () => {
    expect(classifyOpening(["e4", "c5", "c3", "Nf6"])?.name).toContain("Alapin");
    expect(classifyOpening(["e4", "c5", "Nf3"])?.name).toBe("Sicilian Defense");
    expect(classifyOpening(["a3"])).toBeNull();
    expect(classifyOpening([])).toBeNull();
  });
});
