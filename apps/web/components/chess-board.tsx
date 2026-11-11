"use client";

import { useEffect, useRef, useState } from "react";
import { fenToBoard } from "../lib/board";
import {
  analyseMoves,
  barPercent,
  CLASS_LABELS,
  formatScore,
  summarise,
  type MoveClass,
} from "../lib/analysis";
import { analyseGame, type PositionEval } from "../lib/engine";

const DEPTHS = [10, 14, 18] as const;
const CLASS_STYLE: Record<MoveClass, string> = {
  best: "text-success",
  good: "",
  inaccuracy: "text-warning",
  mistake: "text-orange-500",
  blunder: "text-danger",
};

/** Steps through a game's positions and can run Stockfish over them in the browser. */
export function ChessBoard({
  fens,
  sans,
  ucis,
  flip,
}: {
  fens: string[];
  sans: string[];
  ucis: string[];
  flip: boolean;
}) {
  const [ply, setPly] = useState(0);
  const [depth, setDepth] = useState<number>(14);
  const [evals, setEvals] = useState<PositionEval[] | null>(null);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const last = fens.length - 1;
  const go = (n: number) => setPly(Math.max(0, Math.min(last, n)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPly((p) => Math.min(last, p + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  useEffect(() => () => abort.current?.abort(), []);

  async function run() {
    setFailure(null);
    setEvals(null);
    setRunning({ done: 0, total: fens.length });
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const out = await analyseGame(
        fens,
        depth,
        (done, total) => setRunning({ done, total }),
        ctl.signal,
      );
      setEvals(out);
    } catch (e) {
      if (!ctl.signal.aborted) setFailure(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setRunning(null);
    }
  }

  const moves = evals
    ? analyseMoves(
        evals.map((e) => e.white),
        evals.map((e) => e.bestUci),
        ucis,
      )
    : null;
  const summary = moves ? summarise(moves) : null;
  const cur = evals?.[ply];
  const played = ply > 0 ? moves?.[ply - 1] : undefined;
  // The engine's suggestion for the position *before* the move shown, so a mistake can be compared with it.
  const alt = ply > 0 ? evals?.[ply - 1] : undefined;

  const rows = fenToBoard(fens[ply] ?? fens[0]!);
  const ranks = flip ? [...rows].reverse().map((r) => [...r].reverse()) : rows;

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
      <div>
        {cur && (
          <div className="mb-2 max-w-[26rem]">
            <div
              className="h-3 overflow-hidden rounded-sm border border-border bg-black"
              role="img"
              aria-label={`Evaluation ${formatScore(cur.white)} (white's view)`}
            >
              <div className="h-full bg-white" style={{ width: `${barPercent(cur.white)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {formatScore(cur.white)} for white · depth {cur.depth}
              {cur.bestSan ? ` · engine suggests ${cur.bestSan}` : ""}
            </p>
          </div>
        )}
        <div
          role="img"
          aria-label={`Board after ${ply === 0 ? "the start" : `move ${ply}`}`}
          className="grid w-full max-w-[26rem] grid-cols-8 overflow-hidden rounded-md border border-border"
        >
          {ranks.flatMap((row, r) =>
            row.map((piece, c) => (
              <div
                key={`${r}-${c}`}
                className={`flex aspect-square items-center justify-center text-3xl leading-none sm:text-4xl ${
                  (r + c) % 2 === 0 ? "bg-[#e8d9b8] text-black" : "bg-[#9c7a52] text-black"
                }`}
              >
                {piece}
              </div>
            )),
          )}
        </div>
        <div className="mt-2 flex gap-2">
          {(
            [
              ["Start", () => go(0), "⏮"],
              ["Previous move", () => go(ply - 1), "◀"],
              ["Next move", () => go(ply + 1), "▶"],
              ["End", () => go(last), "⏭"],
            ] as const
          ).map(([label, fn, glyph]) => (
            <button
              key={label}
              type="button"
              onClick={fn}
              aria-label={label}
              className="rounded-md border border-border px-3 py-1 text-sm"
            >
              {glyph}
            </button>
          ))}
        </div>
        {played && alt?.bestSan && played.cls !== "best" && (
          <p className="mt-2 max-w-[26rem] text-xs text-muted">
            {CLASS_LABELS[played.cls]} (about {played.loss} centipawns lost). The engine preferred{" "}
            {alt.bestSan}.
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <select
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            disabled={!!running}
            aria-label="Analysis depth"
            className="rounded-md border border-border bg-surface px-2 py-1"
          >
            {DEPTHS.map((d) => (
              <option key={d} value={d}>
                Depth {d}
              </option>
            ))}
          </select>
          {running ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="rounded-md border border-border px-3 py-1"
            >
              Cancel ({running.done}/{running.total})
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              className="rounded-md border border-border px-3 py-1"
            >
              {evals ? "Re-analyse" : "Analyse with Stockfish"}
            </button>
          )}
        </div>
        {failure && <p className="mb-2 text-xs text-danger">{failure}</p>}
        {summary && (
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            {(["white", "black"] as const).map((c) => (
              <div key={c} className="rounded-md border border-border p-2">
                <p className="font-medium capitalize">{c}</p>
                <p className="text-muted">
                  avg loss {summary[c].averageLoss ?? "–"} cp · {summary[c].inaccuracy} inaccuracies
                  · {summary[c].mistake} mistakes · {summary[c].blunder} blunders
                </p>
              </div>
            ))}
          </div>
        )}
        <ol className="max-h-[26rem] overflow-y-auto text-sm" aria-label="Moves">
          {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => (
            <li key={i} className="flex gap-2 py-0.5">
              <span className="w-8 text-muted">{i + 1}.</span>
              {[2 * i, 2 * i + 1].map((idx) =>
                sans[idx] ? (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => go(idx + 1)}
                    title={moves ? CLASS_LABELS[moves[idx]!.cls] : undefined}
                    className={`w-20 rounded px-1 text-left ${
                      ply === idx + 1
                        ? "bg-primary text-white"
                        : `hover:bg-border ${moves ? CLASS_STYLE[moves[idx]!.cls] : ""}`
                    }`}
                  >
                    {sans[idx]}
                    {moves && ["inaccuracy", "mistake", "blunder"].includes(moves[idx]!.cls)
                      ? moves[idx]!.cls === "inaccuracy"
                        ? "?!"
                        : moves[idx]!.cls === "mistake"
                          ? "?"
                          : "??"
                      : ""}
                  </button>
                ) : null,
              )}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted">
          Analysis runs in your browser with Stockfish 19 (lite build). Results are not saved.
          Losses are estimated from evaluation changes at the chosen depth.
        </p>
      </div>
    </div>
  );
}
