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
