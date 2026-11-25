import { Chess } from "chess.js";

export type OverReason =
  "checkmate" | "stalemate" | "insufficient material" | "threefold repetition" | "fifty-move rule";
export type Over = { result: "1-0" | "0-1" | "1/2-1/2"; reason: OverReason };

export type Replay =
  | {
      ok: true;
      fen: string;
      turn: "w" | "b";
      sans: string[];
      over: Over | null;
      check: boolean;
      last: { from: string; to: string } | null;
    }
  | { ok: false; illegalAt: number; sans: string[] };

const UCI = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

function overOf(c: Chess): Over | null {
  if (c.isCheckmate()) return { result: c.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (c.isStalemate()) return { result: "1/2-1/2", reason: "stalemate" };
  if (c.isInsufficientMaterial()) return { result: "1/2-1/2", reason: "insufficient material" };
  if (c.isThreefoldRepetition()) return { result: "1/2-1/2", reason: "threefold repetition" };
  if (c.isDrawByFiftyMoves()) return { result: "1/2-1/2", reason: "fifty-move rule" };
  return null;
}

/**
 * Replays a UCI move list from the starting position. The database stores moves without knowing the rules of chess, so
 * every viewer runs this: an illegal move (or a move after the game was already over) makes the replay fail and the game
 * is shown as invalid. Checkmate and the automatic draws are derived here, never stored.
 */
export function replayMoves(ucis: string[]): Replay {
  const c = new Chess();
  const sans: string[] = [];
  let last: { from: string; to: string } | null = null;
  for (let i = 0; i < ucis.length; i++) {
    if (overOf(c)) return { ok: false, illegalAt: i, sans };
    const m = UCI.exec(ucis[i]!);
    if (!m) return { ok: false, illegalAt: i, sans };
    try {
      const mv = c.move({ from: m[1]!, to: m[2]!, promotion: m[3] });
      sans.push(mv.san);
      last = { from: mv.from, to: mv.to };
    } catch {
      return { ok: false, illegalAt: i, sans };
    }
  }
  return {
    ok: true,
    fen: c.fen(),
    turn: c.turn(),
    sans,
    over: overOf(c),
    check: c.isCheck(),
    last,
  };
}

/** True when `uci` is a legal next move after `moves` (and the game is not already over). */
export function isLegalNext(moves: string[], uci: string): boolean {
  return replayMoves([...moves, uci]).ok;
}

export type GameRow = {
  status: string;
  moves: string[];
  white_id: string | null;
  black_id: string | null;
  resigned_by: string | null;
  timed_out_by?: string | null;
};

export type Summary = {
  finished: boolean;
  /** Result in PGN notation, or null while the game is open. */
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  text: string;
};

const colorOf = (g: GameRow, uid: string | null): "w" | "b" | null =>
  uid && uid === g.white_id ? "w" : uid && uid === g.black_id ? "b" : null;

export function summarise(g: GameRow, rep: Replay): Summary {
  if (g.status === "waiting")
    return { finished: false, result: null, text: "Waiting for an opponent" };
  if (g.status === "cancelled") return { finished: true, result: null, text: "Cancelled" };
  if (!rep.ok)
    return {
      finished: true,
      result: null,
      text: `Invalid game: move ${rep.illegalAt + 1} is not legal`,
    };
  if (g.status === "resigned") {
    const loser = colorOf(g, g.resigned_by);
    const result = loser === "w" ? "0-1" : "1-0";
    return {
      finished: true,
      result,
      text: `${loser === "w" ? "White" : "Black"} resigned. ${loser === "w" ? "Black" : "White"} wins`,
    };
  }
  if (g.status === "draw") return { finished: true, result: "1/2-1/2", text: "Draw agreed" };
  if (g.status === "timeout") {
    const loser = colorOf(g, g.timed_out_by ?? null);
    const result = loser === "w" ? "0-1" : "1-0";
    return {
      finished: true,
      result,
      text: `${loser === "w" ? "White" : "Black"} lost on time. ${loser === "w" ? "Black" : "White"} wins`,
    };
  }
  if (rep.over) {
    const { result, reason } = rep.over;
    const text =
      result === "1/2-1/2"
        ? `Draw by ${reason}`
        : `${reason[0]!.toUpperCase()}${reason.slice(1)}. ${result === "1-0" ? "White" : "Black"} wins`;
    return { finished: true, result, text };
  }
  return {
    finished: false,
    result: null,
    text: `${rep.turn === "w" ? "White" : "Black"} to move${rep.check ? " (check)" : ""}`,
  };
}

/** Which side the viewer plays, or null for a non-participant. */
export const sideOf = (g: GameRow, uid: string | null): "white" | "black" | null => {
  const c = colorOf(g, uid);
  return c === "w" ? "white" : c === "b" ? "black" : null;
};

/** Moves in numbered pairs: ["1. e4 e5", "2. Nf3"]. */
export function movePairs(sans: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < sans.length; i += 2)
    out.push(`${i / 2 + 1}. ${sans[i]}${sans[i + 1] ? ` ${sans[i + 1]}` : ""}`);
  return out;
}

export const INVITE_CODE = /^[0-9a-f]{32}$/;

/** Time controls offered when creating a game: label, minutes per side and seconds added per move. */
export const TIME_CONTROLS = [
  { id: "none", label: "No clock", minutes: null, increment: 0 },
  { id: "3+2", label: "Blitz 3 min + 2 s", minutes: 3, increment: 2 },
  { id: "5+0", label: "Blitz 5 min", minutes: 5, increment: 0 },
  { id: "10+0", label: "Rapid 10 min", minutes: 10, increment: 0 },
  { id: "15+10", label: "Rapid 15 min + 10 s", minutes: 15, increment: 10 },
  { id: "30+0", label: "Classical 30 min", minutes: 30, increment: 0 },
] as const;

export function timeControl(id: string) {
  return TIME_CONTROLS.find((t) => t.id === id) ?? null;
}

export type ClockGame = {
  status: string;
  moves: string[];
  clock_seconds: number | null;
  white_ms: number | null;
  black_ms: number | null;
  clock_started_at: string | null;
};

export type Clocks = {
  whiteMs: number;
  blackMs: number;
  /** Whose clock is running (only once both sides have moved), or null. */
  running: "w" | "b" | null;
};

/** Remaining time of both sides at `nowMs` (the server's time), or null for an untimed game. */
export function clocksAt(g: ClockGame, nowMs: number): Clocks | null {
  if (g.clock_seconds === null || g.white_ms === null || g.black_ms === null) return null;
  const running =
    g.status === "active" && g.moves.length >= 2 && g.clock_started_at
      ? g.moves.length % 2 === 0
        ? "w"
        : "b"
      : null;
  const spent = running ? Math.max(0, nowMs - Date.parse(g.clock_started_at!)) : 0;
  return {
    whiteMs: Math.max(0, g.white_ms - (running === "w" ? spent : 0)),
    blackMs: Math.max(0, g.black_ms - (running === "b" ? spent : 0)),
    running,
  };
}

/** 4:05, or 0:07.3 under ten seconds. */
export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 10_000) return `0:0${(Math.floor(t / 100) / 10).toFixed(1)}`;
  const s = Math.floor(t / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * How often the page should poll for changes. While the realtime channel is subscribed it only
 * checks occasionally, as a safety net for a missed message; without it, polling is the only way
 * the page learns about a move.
 */
export function pollIntervalMs(channel: "subscribed" | "connecting" | "failed"): number {
  return channel === "subscribed" ? 30000 : 3000;
}

/** The 32-character invite code from a pasted link or the bare code, or null. */
export function extractInviteCode(text: string): string | null {
  const m = /[0-9a-f]{32}/i.exec(text.trim());
  return m ? m[0].toLowerCase() : null;
}

/** Promotion pieces (q, r, b, n) a from/to tap allows; empty when the move is not a promotion or is illegal. */
export function promotionPieces(fen: string, from: string, to: string): string[] {
  try {
    const ms = new Chess(fen)
      .moves({ verbose: true })
      .filter((m) => m.from === from && m.to === to && m.promotion);
    return ms.map((m) => m.promotion!);
  } catch {
    return [];
  }
}

/** UCI for a from/to tap (with the chosen promotion piece), or null when it is not a legal move in this position. */
export function uciFor(fen: string, from: string, to: string, promotion?: string): string | null {
  try {
    const m = new Chess(fen)
      .moves({ verbose: true })
      .find((x) => x.from === from && x.to === to && (x.promotion ?? "") === (promotion ?? ""));
    return m ? from + to + (m.promotion ?? "") : null;
  } catch {
    return null;
  }
}

/** UCI for a queued premove once it is our turn (promotes to a queen), or null if it is no longer legal. */
export function resolvePremove(fen: string, from: string, to: string): string | null {
  return uciFor(fen, from, to) ?? uciFor(fen, from, to, "q");
}
