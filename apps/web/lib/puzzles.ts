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

/** Plays a UCI move from a FEN. Returns the SAN or null if the move is illegal or the FEN is invalid. */
export function sanForUci(fen: string, uci: string): string | null {
  try {
    const c = new Chess(fen);
    return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

/** Finds the legal move for a from/to click, choosing the promotion piece from the solution when it matches. */
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

/** Squares the piece on `from` can legally move to in this position (empty if there is none or the FEN is invalid). */
export function legalTargets(fen: string, from: string): Set<string> {
  try {
    const c = new Chess(fen);
    return new Set(c.moves({ square: from as never, verbose: true }).map((m) => m.to));
  } catch {
    return new Set();
  }
}

const PROMO_ORDER = ["q", "r", "b", "n"];

/** Promotion pieces ("q", "r", "b", "n") a move from `from` to `to` can choose between; empty when it is not a promotion. */
export function promotionChoices(fen: string, from: string, to: string): string[] {
  try {
    const found = new Chess(fen)
      .moves({ verbose: true })
      .filter((m) => m.from === from && m.to === to && m.promotion)
      .map((m) => m.promotion as string);
    return PROMO_ORDER.filter((p) => found.includes(p));
  } catch {
    return [];
  }
}

/** The legal move from `from` to `to` with the chosen promotion piece (ignored when the move is not a promotion). */
export function moveWith(
  fen: string,
  from: string,
  to: string,
  promotion?: string,
): { uci: string; san: string } | null {
  try {
    const m = new Chess(fen)
      .moves({ verbose: true })
      .find((x) => x.from === from && x.to === to && (!x.promotion || x.promotion === promotion));
    return m ? { uci: from + to + (m.promotion ?? ""), san: m.san } : null;
  } catch {
    return null;
  }
}

/** The UCI to play for a stored premove once the position arrives, or null if it is no longer legal. Promotes to a queen. */
export function resolvePremove(fen: string, from: string, to: string): string | null {
  return moveWith(fen, from, to, "q")?.uci ?? null;
}
