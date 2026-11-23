// Chess puzzle logic for the phone, mirroring apps/web/lib/puzzles.ts and apps/web/lib/board.ts. Pure (chess.js only).
import { Chess } from "chess.js";

/** Leitner-style schedule: days until the next review for each box after a correct answer. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;
const RETRY_MINUTES = 10;

export function nextSchedule(
  box: number,
  correct: boolean,
  now: Date,
): { box: number; dueAt: Date } {
  if (!correct) return { box: 0, dueAt: new Date(now.getTime() + RETRY_MINUTES * 60_000) };
  const next = Math.min(5, Math.max(0, box) + 1);
  return { box: next, dueAt: new Date(now.getTime() + BOX_DAYS[next]! * 86_400_000) };
}

/** 8x8 grid (rank 8 first) of FEN piece letters ("" for empty), e.g. "K", "p". */
export function fenToLetters(fen: string): string[][] {
  const placement = fen.split(" ")[0] ?? "";
  return placement.split("/").map((row) => {
    const cells: string[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push("");
      else cells.push(/[KQRBNPkqrbnp]/.test(ch) ? ch : "");
    }
    return cells;
  });
}

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

/** Solid glyph for a piece letter; the colour is applied by the caller. "" for empty. */
export function glyph(letter: string): string {
  return GLYPH[letter.toLowerCase()] ?? "";
}

export const isWhitePiece = (letter: string) => letter !== "" && letter === letter.toUpperCase();

const FILES = "abcdefgh";

/** Square name (e.g. "e4") for a display row and column, with the board flipped when Black is at the bottom. */
export function squareAt(row: number, col: number, flip: boolean): string {
  const file = flip ? 7 - col : col;
  const rank = flip ? row + 1 : 8 - row;
  return `${FILES[file]}${rank}`;
}

/** Display grid for the side at the bottom: rows reversed and each row reversed when flipped. */
export function orient(grid: string[][], flip: boolean): string[][] {
  return flip ? [...grid].reverse().map((r) => [...r].reverse()) : grid;
}

/** Plays a UCI move from a FEN. Returns the SAN or null if the move is illegal or the FEN is invalid. */
export function sanForUci(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      .san;
  } catch {
    return null;
  }
}

/** The legal move for a from/to tap, choosing the promotion piece from the solution when it matches (else queen). */
export function resolveClick(
  fen: string,
  from: string,
  to: string,
  solutionUci: string,
): { uci: string; san: string } | null {
  let c: Chess;
  try {
    c = new Chess(fen);
  } catch {
    return null;
  }
  const m = c.moves({ verbose: true }).filter((x) => x.from === from && x.to === to);
  if (m.length === 0) return null;
  if (m.length === 1) return { uci: from + to + (m[0]!.promotion ?? ""), san: m[0]!.san };
  const wanted = solutionUci.startsWith(from + to) ? solutionUci[4] : undefined;
  const pick = m.find((x) => x.promotion === wanted) ?? m.find((x) => x.promotion === "q") ?? m[0]!;
  return { uci: from + to + (pick.promotion ?? ""), san: pick.san };
}

/** Squares the piece on `from` can legally reach (empty when there is no piece or the FEN is invalid). */
export function legalTargets(fen: string, from: string): Set<string> {
  try {
    return new Set(new Chess(fen).moves({ square: from as never, verbose: true }).map((m) => m.to));
  } catch {
    return new Set();
  }
}

/** True when the square holds a piece of the side to move's colour ("white" or "black"). */
export function ownsSquare(fen: string, square: string, side: "white" | "black"): boolean {
  try {
    const p = new Chess(fen).get(square as never);
    return !!p && p.color === (side === "white" ? "w" : "b");
  } catch {
    return false;
  }
}

export type PuzzleRow = {
  id: string;
  game_id: string;
  fen: string;
  side_to_move: string;
  solution_uci: string;
  played_uci: string;
  loss_cp: number;
  box: number;
  attempts: number;
  correct: number;
  revision: number;
};
