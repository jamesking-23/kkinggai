import { replay } from "./chess";

export * from "./repertoire-format";
import type { RepGame, RepPosition } from "./repertoire-format";
/** Default depth (plies) and the number of games a position needs before it counts as part of a repertoire. */
export const REP_MAX_PLY = 16;
export const REP_MIN_GAMES = 2;

/** FEN with the halfmove clock and move number dropped. */
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function scoreFor(result: string, color: "white" | "black"): "win" | "draw" | "loss" | null {
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return color === "white" ? "win" : "loss";
  if (result === "0-1") return color === "black" ? "win" : "loss";
  return null; // unfinished
}

/**
 * The user's opening repertoire from their own games: every position (within the first `maxPly` plies) where it was
 * the user's turn and that came up in at least `minGames` games, with the moves played from it and how they scored.
 * Games without a known side or that cannot be replayed are skipped. Most-visited positions first.
 */
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
    const outcome = scoreFor(g.result, color);
    const limit = Math.min(maxPly, played.sans.length);
    for (let i = 0; i < limit; i++) {
      const userTurn = (i % 2 === 0) === (color === "white");
      if (!userTurn) continue;
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

/** Positions worth drilling: a clear main move (played in at least 60 % of the games that reached it). */
export function drillPositions(positions: readonly RepPosition[]): RepPosition[] {
  return positions.filter((p) => p.moves[0]!.count / p.total >= 0.6);
}
