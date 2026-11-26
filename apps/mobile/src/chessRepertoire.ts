// Opening repertoire from your own games, for the phone. Mirrors apps/web/lib/repertoire.ts. Pure (chess.js only).
import { replay } from "./chessGames";

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
  key: string;
  fen: string;
  color: "white" | "black";
  path: string[];
  total: number;
  moves: RepMove[];
};

export const REP_MAX_PLY = 16;
export const REP_MIN_GAMES = 2;

/** FEN without the move counters, so transpositions are the same position. */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** "1. e4 c5 2. Nf3" for SAN moves from the start. */
export function formatPath(path: readonly string[]): string {
  if (path.length === 0) return "Starting position";
  return path.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(" ");
}

/** Score as a percentage (a draw is half) over decided games, or null with none. */
export function scorePercent(m: Pick<RepMove, "wins" | "draws" | "losses">): number | null {
  const n = m.wins + m.draws + m.losses;
  return n === 0 ? null : Math.round(((m.wins + m.draws / 2) / n) * 100);
}

function outcomeFor(result: string, color: "white" | "black"): "win" | "draw" | "loss" | null {
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return color === "white" ? "win" : "loss";
  if (result === "0-1") return color === "black" ? "win" : "loss";
  return null;
}

/** Positions (first `maxPly` plies, your turn) reached in at least `minGames` games, with the moves played and how they scored. */
export function buildRepertoire(
  games: readonly RepGame[],
  maxPly = REP_MAX_PLY,
  minGames = REP_MIN_GAMES,
): RepPosition[] {
  const map = new Map<string, RepPosition>();
  for (const g of games) {
    const color = g.user_color === "white" || g.user_color === "black" ? g.user_color : null;
    if (!color) continue;
    const played = replay(g.pgn);
    if (!played) continue;
    const outcome = outcomeFor(g.result, color);
    const limit = Math.min(maxPly, played.sans.length);
    for (let i = 0; i < limit; i++) {
      if ((i % 2 === 0) !== (color === "white")) continue;
      const key = `${color}|${positionKey(played.fens[i]!)}`;
      let pos = map.get(key);
      if (!pos) {
        pos = {
          key: positionKey(played.fens[i]!),
          fen: played.fens[i]!,
          color,
          path: played.sans.slice(0, i),
          total: 0,
          moves: [],
        };
        map.set(key, pos);
      }
      pos.total++;
      let m = pos.moves.find((x) => x.uci === played.ucis[i]);
      if (!m) {
        m = { san: played.sans[i]!, uci: played.ucis[i]!, count: 0, wins: 0, draws: 0, losses: 0 };
        pos.moves.push(m);
      }
      m.count++;
      if (outcome === "win") m.wins++;
      else if (outcome === "draw") m.draws++;
      else if (outcome === "loss") m.losses++;
    }
  }
  return [...map.values()]
    .filter((p) => p.total >= minGames)
    .map((p) => ({ ...p, moves: [...p.moves].sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.total - a.total || a.path.length - b.path.length);
}

/** Positions with a clear main move (at least 60 % of the games that reached them). */
export function drillPositions(positions: readonly RepPosition[]): RepPosition[] {
  return positions.filter((p) => p.moves[0]!.count / p.total >= 0.6);
}
