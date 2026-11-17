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
