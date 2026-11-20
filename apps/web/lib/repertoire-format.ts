// Pure types and formatters with no server-only imports, safe for client components.

export type RepGame = { pgn: string; user_color: string | null; result: string };

export type RepMove = {
  san: string;
  uci: string;
  count: number;
  wins: number;
  draws: number;
  losses: number;
};

export type RepPosition = {
  /** FEN without the move counters, so transpositions with different move numbers are the same position. */
  key: string;
  /** Full FEN of the first time the position was reached (used to show the board). */
  fen: string;
  color: "white" | "black";
  /** Moves played to reach it, in SAN, from the first game that got there. */
  path: string[];
  total: number;
  moves: RepMove[];
};

/** "1. e4 c5 2. Nf3" for a list of SAN moves from the start. */
export function formatPath(path: readonly string[]): string {
  if (path.length === 0) return "Starting position";
  return path.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(" ");
}

/** Score as a percentage (a draw counts half) over decided games, or null with none. */
export function scorePercent(m: Pick<RepMove, "wins" | "draws" | "losses">): number | null {
  const n = m.wins + m.draws + m.losses;
  return n === 0 ? null : Math.round(((m.wins + m.draws / 2) / n) * 100);
}
