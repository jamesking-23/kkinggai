import { describe, expect, it } from "vitest";
import {
  clocksAt,
  formatClock,
  INVITE_CODE,
  isLegalNext,
  movePairs,
  replayMoves,
  sideOf,
  summarise,
  timeControl,
  TIME_CONTROLS,
} from "./mp";

const SCHOLARS = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"];

describe("replayMoves", () => {
  it("replays a legal opening and reports whose turn it is", () => {
    const r = replayMoves(["e2e4", "e7e5"]);
    expect(r.ok && r.turn).toBe("w");
    expect(r.ok && r.sans).toEqual(["e4", "e5"]);
    expect(r.ok && r.last).toEqual({ from: "e7", to: "e5" });
  });
  it("derives checkmate", () => {
    const r = replayMoves(SCHOLARS);
    expect(r.ok && r.over).toEqual({ result: "1-0", reason: "checkmate" });
    expect(r.ok && r.check).toBe(true);
  });
  it("flags illegal and malformed moves", () => {
    expect(replayMoves(["e2e5"])).toMatchObject({ ok: false, illegalAt: 0 });
    expect(replayMoves(["e2e4", "e7e5", "e1e3"])).toMatchObject({ ok: false, illegalAt: 2 });
    expect(replayMoves(["e2e4", "zz"])).toMatchObject({ ok: false, illegalAt: 1 });
    expect(replayMoves(["e2e4", "e2e4"])).toMatchObject({ ok: false, illegalAt: 1 });
  });
  it("rejects any move after the game is over", () => {
    expect(replayMoves([...SCHOLARS, "e8f8"])).toMatchObject({ ok: false, illegalAt: 7 });
  });
  it("derives a draw by threefold repetition and ends the game there", () => {
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    const r = replayMoves([...shuffle, ...shuffle]);
    expect(r.ok && r.over).toEqual({ result: "1/2-1/2", reason: "threefold repetition" });
    expect(replayMoves([...shuffle, ...shuffle, "e2e4"]).ok).toBe(false);
  });
  it("derives stalemate", () => {
    // Known quick stalemate line.
    const moves = [
      "e2e3",
      "a7a5",
      "d1h5",
      "a8a6",
      "h5a5",
      "h7h5",
      "a5c7",
      "a6h6",
      "h2h4",
      "f7f6",
      "c7d7",
      "e8f7",
      "d7b7",
      "d8d3",
      "b7b8",
      "d3h7",
      "b8c8",
      "f7g6",
      "c8e6",
    ];
    const r = replayMoves(moves);
    expect(r.ok && r.over).toEqual({ result: "1/2-1/2", reason: "stalemate" });
  });
  it("handles promotion by capture", () => {
    const r = replayMoves([
      "a2a4",
      "b7b5",
      "a4b5",
      "a7a6",
      "b5a6",
      "g8f6",
      "a6a7",
      "h7h6",
      "a7b8q",
    ]);
    expect(r.ok && r.sans.at(-1)).toBe("axb8=Q");
  });
});

describe("isLegalNext", () => {
  it("checks a candidate move against the current game", () => {
    expect(isLegalNext([], "e2e4")).toBe(true);
    expect(isLegalNext([], "e2e5")).toBe(false);
    expect(isLegalNext(SCHOLARS, "e8f8")).toBe(false);
  });
});

describe("summarise", () => {
  const base = { moves: [] as string[], white_id: "w", black_id: "b", resigned_by: null };
  it("describes an open game", () => {
    const s = summarise({ ...base, status: "active" }, replayMoves([]));
    expect(s).toEqual({ finished: false, result: null, text: "White to move" });
    expect(summarise({ ...base, status: "waiting" }, replayMoves([])).text).toMatch(/Waiting/);
  });
  it("describes resignation, agreed draws and checkmate", () => {
    const rep = replayMoves(["e2e4"]);
    expect(summarise({ ...base, status: "resigned", resigned_by: "w" }, rep)).toMatchObject({
      result: "0-1",
      text: "White resigned. Black wins",
    });
    expect(summarise({ ...base, status: "draw" }, rep).result).toBe("1/2-1/2");
    const mate = summarise({ ...base, status: "active", moves: SCHOLARS }, replayMoves(SCHOLARS));
    expect(mate).toEqual({ finished: true, result: "1-0", text: "Checkmate. White wins" });
  });
  it("reports an invalid game", () => {
    const s = summarise({ ...base, status: "active" }, replayMoves(["e2e5"]));
    expect(s.text).toBe("Invalid game: move 1 is not legal");
    expect(s.finished).toBe(true);
  });
});

describe("helpers", () => {
  it("identifies the viewer's side", () => {
    const g = { status: "active", moves: [], white_id: "w", black_id: "b", resigned_by: null };
    expect(sideOf(g, "w")).toBe("white");
    expect(sideOf(g, "b")).toBe("black");
    expect(sideOf(g, "x")).toBeNull();
    expect(sideOf(g, null)).toBeNull();
  });
  it("formats move pairs", () => {
    expect(movePairs(["e4", "e5", "Nf3"])).toEqual(["1. e4 e5", "2. Nf3"]);
  });
  it("accepts only 32-character hex invite codes", () => {
    expect(INVITE_CODE.test("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(INVITE_CODE.test("../etc/passwd")).toBe(false);
    expect(INVITE_CODE.test("ABCDEF0123456789ABCDEF0123456789")).toBe(false);
  });
});

describe("clocks", () => {
  const base = {
    status: "active",
    moves: ["e2e4", "e7e5", "g1f3"],
    clock_seconds: 300,
    white_ms: 290_000,
    black_ms: 300_000,
    clock_started_at: "2026-11-19T10:00:00.000Z",
  };
  const t0 = Date.parse("2026-11-19T10:00:00.000Z");

  it("returns null for an untimed game", () => {
    expect(
      clocksAt({ ...base, clock_seconds: null, white_ms: null, black_ms: null }, t0),
    ).toBeNull();
  });
  it("runs only the side to move, and only after both sides have moved", () => {
    expect(clocksAt(base, t0 + 5000)).toEqual({ whiteMs: 290_000, blackMs: 295_000, running: "b" });
    expect(clocksAt({ ...base, moves: ["e2e4", "e7e5"] }, t0 + 5000)).toEqual({
      whiteMs: 285_000,
      blackMs: 300_000,
      running: "w",
    });
    expect(clocksAt({ ...base, moves: ["e2e4"] }, t0 + 60_000)).toEqual({
      whiteMs: 290_000,
      blackMs: 300_000,
      running: null,
    });
    expect(clocksAt({ ...base, moves: [] }, t0 + 60_000)?.running).toBeNull();
  });
  it("stops when the game is over and never goes below zero", () => {
    expect(clocksAt({ ...base, status: "resigned" }, t0 + 60_000)?.running).toBeNull();
    expect(clocksAt(base, t0 + 999_999)?.blackMs).toBe(0);
  });
  it("formats times", () => {
    expect(formatClock(245_000)).toBe("4:05");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(7_300)).toBe("0:07.3");
    expect(formatClock(-5)).toBe("0:00.0");
  });
  it("lists valid time controls only", () => {
    expect(timeControl("5+0")).toMatchObject({ minutes: 5, increment: 0 });
    expect(timeControl("none")?.minutes).toBeNull();
    expect(timeControl("1+99")).toBeNull();
    for (const t of TIME_CONTROLS) expect(t.increment).toBeLessThanOrEqual(60);
  });
  it("describes a loss on time", () => {
    const g = {
      status: "timeout",
      moves: ["e2e4", "e7e5"],
      white_id: "w",
      black_id: "b",
      resigned_by: null,
      timed_out_by: "b",
    };
    const s = summarise(g, replayMoves(g.moves));
    expect(s).toEqual({ finished: true, result: "1-0", text: "Black lost on time. White wins" });
  });
});

describe("pollIntervalMs", () => {
  it("polls slowly while realtime works and quickly otherwise", async () => {
    const { pollIntervalMs } = await import("./mp");
    expect(pollIntervalMs("subscribed")).toBe(30000);
    expect(pollIntervalMs("connecting")).toBe(3000);
    expect(pollIntervalMs("failed")).toBe(3000);
  });
});
