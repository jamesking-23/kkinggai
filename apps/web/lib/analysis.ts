/** Pure helpers for engine analysis: UCI parsing, score conversion and move classification. */

export type EngineScore = { cp: number } | { mate: number };

export type InfoLine = { depth: number; score: EngineScore; pv: string[] };

/** Parses a UCI "info" line. Returns null for lines without a depth and score (or for MultiPV lines beyond the first). */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith("info ")) return null;
  const t = line.split(/\s+/);
  const at = (k: string) => t.indexOf(k);
  const mp = at("multipv");
  if (mp >= 0 && t[mp + 1] !== "1") return null;
  const d = at("depth");
  const s = at("score");
  if (d < 0 || s < 0) return null;
  const depth = Number(t[d + 1]);
  const kind = t[s + 1];
  const val = Number(t[s + 2]);
  if (!Number.isFinite(depth) || !Number.isFinite(val)) return null;
  const score: EngineScore | null =
    kind === "cp" ? { cp: val } : kind === "mate" ? { mate: val } : null;
  if (!score) return null;
  const p = at("pv");
  return { depth, score, pv: p >= 0 ? t.slice(p + 1) : [] };
}

const MATE_CP = 10000;

/** Score from the side to move's view → white's view in centipawns. Mate scores become ±(10000 − distance). */
export function whiteCp(score: EngineScore, sideToMove: "w" | "b"): number {
  const stm =
    "cp" in score
      ? score.cp
      : score.mate > 0
        ? MATE_CP - score.mate
        : score.mate === 0
          ? -MATE_CP
          : -MATE_CP - score.mate;
  return sideToMove === "w" ? stm : -stm;
}

export function formatScore(whiteView: number): string {
  if (Math.abs(whiteView) >= MATE_CP - 200) {
    const n = MATE_CP - Math.abs(whiteView);
    return `${whiteView > 0 ? "" : "-"}M${n}`;
  }
  const v = whiteView / 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

/** White's share of the bar, 0..100. */
export function barPercent(whiteView: number): number {
  const c = Math.max(-1000, Math.min(1000, whiteView));
  return Math.round(50 + 50 * (2 / (1 + Math.exp(-c / 400)) - 1));
}

export type MoveClass = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export const CLASS_LABELS: Record<MoveClass, string> = {
  best: "Best",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

const CLAMP = 1000;
const clamp = (v: number) => Math.max(-CLAMP, Math.min(CLAMP, v));

export function classifyLoss(loss: number): Exclude<MoveClass, "best"> {
  if (loss < 30) return "good";
  if (loss < 80) return "inaccuracy";
  if (loss < 200) return "mistake";
  return "blunder";
}

export type MoveAnalysis = { ply: number; color: "white" | "black"; loss: number; cls: MoveClass };

/**
 * Compares the evaluation before and after each move. `evals[i]` is white's-view centipawns for position i
 * (position 0 is the start); `bestUci[i]` is the engine's best move in position i; `playedUci[i]` is the move played
 * from position i. Evaluations are clamped to ±1000 so a mate swing does not dominate the averages.
 */
export function analyseMoves(
  evals: number[],
  bestUci: (string | null)[],
  playedUci: string[],
): MoveAnalysis[] {
  return playedUci.map((played, i) => {
    const color = i % 2 === 0 ? "white" : "black";
    const before = clamp(evals[i]!);
    const after = clamp(evals[i + 1]!);
    const loss = Math.max(0, color === "white" ? before - after : after - before);
    const cls: MoveClass = bestUci[i] && bestUci[i] === played ? "best" : classifyLoss(loss);
    return { ply: i + 1, color, loss, cls };
  });
}

export type SideSummary = { moves: number; averageLoss: number | null } & Record<MoveClass, number>;

export function summarise(moves: MoveAnalysis[]): { white: SideSummary; black: SideSummary } {
  const one = (color: "white" | "black"): SideSummary => {
    const m = moves.filter((x) => x.color === color);
    const s: SideSummary = {
      moves: m.length,
      averageLoss: m.length ? Math.round(m.reduce((a, x) => a + x.loss, 0) / m.length) : null,
      best: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    };
    for (const x of m) s[x.cls]++;
    return s;
  };
  return { white: one("white"), black: one("black") };
}
