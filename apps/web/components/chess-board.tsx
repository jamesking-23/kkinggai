"use client";

import { useEffect, useRef, useState } from "react";
import { fenToBoard } from "../lib/board";
import { Board } from "./board";
import {
  analyseMoves,
  barPercent,
  CLASS_LABELS,
  formatScore,
  summarise,
  type MoveClass,
} from "../lib/analysis";
import { analyseGame, type PositionEval } from "../lib/engine";
import { saveAnalysis, savePuzzles } from "../app/(app)/chess/actions";

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
  gameId,
  canSavePuzzles,
  savedEvals,
  savedDepth,
}: {
  fens: string[];
  sans: string[];
  ucis: string[];
  flip: boolean;
  gameId: string;
  canSavePuzzles: boolean;
  /** A stored analysis for this game, shown without running the engine again. */
  savedEvals?: PositionEval[] | null;
  savedDepth?: number | null;
}) {
  const [ply, setPly] = useState(0);
  const [depth, setDepth] = useState<number>(14);
  const [evals, setEvals] = useState<PositionEval[] | null>(savedEvals ?? null);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(
    savedEvals ? `Showing your saved analysis${savedDepth ? ` (depth ${savedDepth})` : ""}.` : null,
  );
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

  async function saveMistakes() {
    if (!evals || !moves) return;
    const items = moves
      .filter((m) => m.cls === "mistake" || m.cls === "blunder")
      .map((m) => ({
        ply: m.ply,
        best: evals[m.ply - 1]?.bestUci ?? "",
        loss: Math.round(m.loss),
        depth: evals[m.ply - 1]?.depth ?? 0,
      }))
      .filter((i) => i.best);
    if (items.length === 0) return setSaveNote("No mistakes or blunders to save.");
    setSaveNote("Saving...");
    const res = await savePuzzles({ gameId, items });
    setSaveNote(
      res.ok
        ? res.saved > 0
          ? `Saved ${res.saved} puzzle${res.saved === 1 ? "" : "s"} from your moves.`
          : "Nothing new to save (already saved, or not your moves)."
        : res.error,
    );
  }

  async function run() {
    setFailure(null);
    setSaveNote(null);
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
      const res = await saveAnalysis({ gameId, depth, evals: out });
      setSaveNote(
        res.ok ? "Analysis saved. It will be here next time." : `Not saved: ${res.error}`,
      );
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

  const FILES = "abcdefgh";
  const sq = (r: number, c: number) => `${FILES[flip ? 7 - c : c]}${flip ? r + 1 : 8 - r}`;
  const lastUci = ply > 0 ? ucis[ply - 1] : undefined;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[auto_1fr]">
      <Board
        animate={false}
        rows={ranks}
        square={sq}
        label={`Board after ${ply === 0 ? "the start" : `move ${ply}`}`}
        last={lastUci ? { from: lastUci.slice(0, 2), to: lastUci.slice(2, 4) } : null}
        before={
          cur ? (
            <div className="mb-2">
              <div
                className="h-3 overflow-hidden rounded-full border border-border bg-black"
                role="img"
                aria-label={`Evaluation ${formatScore(cur.white)} (white's view)`}
              >
                <div
                  className="h-full bg-white transition-[width] duration-500"
                  style={{ width: `${barPercent(cur.white)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                {formatScore(cur.white)} for white · depth {cur.depth}
                {cur.bestSan ? ` · engine suggests ${cur.bestSan}` : ""}
              </p>
            </div>
          ) : null
        }
        after={
          <>
            <div className="mt-3 flex gap-2">
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
                  className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-raised"
                >
                  {glyph}
                </button>
              ))}
            </div>
            {played && alt?.bestSan && played.cls !== "best" && (
              <p className="mt-2 text-xs text-muted">
                {CLASS_LABELS[played.cls]} (about {played.loss} centipawns lost). The engine
                preferred {alt.bestSan}.
              </p>
            )}
          </>
        }
      />

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
        {summary && canSavePuzzles && (
          <div className="mb-3 text-xs">
            <button
              type="button"
              onClick={saveMistakes}
              className="rounded-md border border-border px-3 py-1 text-sm"
            >
              Save my mistakes as puzzles
            </button>
            {saveNote && <span className="ml-2 text-muted">{saveNote}</span>}
          </div>
        )}
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
          Analysis runs in your browser with Stockfish 19 (lite build). The analysis itself is not
          saved; only mistakes you choose to save become puzzles. Losses are estimated from
          evaluation changes at the chosen depth.
        </p>
      </div>
    </div>
  );
}
