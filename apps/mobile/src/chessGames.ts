// Game list and replay helpers for the phone, mirroring apps/web/lib/chess.ts. Pure (chess.js only).
import { Chess } from "chess.js";

export type GameRow = {
  id: string;
  white: string;
  black: string;
  result: string;
  user_color: "white" | "black" | null;
  opening: string | null;
  played_on: string | null;
  white_elo: number | null;
  black_elo: number | null;
  move_count: number;
  time_control: string | null;
};

export type Replay = { sans: string[]; ucis: string[]; fens: string[] };

/** SAN list, UCI list and a FEN for every position (index 0 is the start). Null when the PGN is invalid. */
export function replay(pgn: string): Replay | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  const verbose = chess.history({ verbose: true });
  const start = verbose[0]?.before ?? new Chess().fen();
  return {
    sans: verbose.map((m) => m.san),
    ucis: verbose.map((m) => m.from + m.to + (m.promotion ?? "")),
    fens: [start, ...verbose.map((m) => m.after)],
  };
}

export type Outcome = "win" | "draw" | "loss";

export function outcomeFor(g: Pick<GameRow, "result" | "user_color">): Outcome | null {
  if (!g.user_color || g.result === "*") return null;
  if (g.result === "1/2-1/2") return "draw";
  const whiteWon = g.result === "1-0";
  return (g.user_color === "white") === whiteWon ? "win" : "loss";
}

/** "You vs Magnus" style title: the opponent when your colour is known, else "White vs Black". */
export function gameTitle(g: Pick<GameRow, "white" | "black" | "user_color">): string {
  if (g.user_color === "white") return `You vs ${g.black}`;
  if (g.user_color === "black") return `You vs ${g.white}`;
  return `${g.white} vs ${g.black}`;
}

export function resultLabel(g: Pick<GameRow, "result" | "user_color">): string {
  const o = outcomeFor(g);
  if (o === "win") return "Win";
  if (o === "loss") return "Loss";
  if (o === "draw") return "Draw";
  return g.result === "*" ? "Unfinished" : g.result;
}

/** Moves grouped as "1. e4 e5": index 0 of each pair is White's move. */
export function movePairs(
  sans: readonly string[],
): { n: number; white: string; black: string | null; whitePly: number }[] {
  const out: { n: number; white: string; black: string | null; whitePly: number }[] = [];
  for (let i = 0; i < sans.length; i += 2) {
    out.push({ n: i / 2 + 1, white: sans[i]!, black: sans[i + 1] ?? null, whitePly: i + 1 });
  }
  return out;
}

/** Keeps a position index inside 0..max. */
export function clampPly(ply: number, max: number): number {
  if (!Number.isFinite(ply)) return 0;
  return Math.min(Math.max(0, Math.trunc(ply)), Math.max(0, max));
}

/** The highlighted last move (from, to) for a position index, or null at the start. */
export function lastMove(
  ucis: readonly string[],
  ply: number,
): { from: string; to: string } | null {
  const u = ucis[ply - 1];
  return u ? { from: u.slice(0, 2), to: u.slice(2, 4) } : null;
}

/** Filters by result outcome and a text query on opponent names or opening. */
export function filterGames<
  T extends Pick<GameRow, "white" | "black" | "opening" | "result" | "user_color">,
>(games: readonly T[], outcome: Outcome | "all", query: string): T[] {
  const q = query.trim().toLowerCase();
  return games.filter(
    (g) =>
      (outcome === "all" || outcomeFor(g) === outcome) &&
      (!q ||
        g.white.toLowerCase().includes(q) ||
        g.black.toLowerCase().includes(q) ||
        (g.opening ?? "").toLowerCase().includes(q)),
  );
}
