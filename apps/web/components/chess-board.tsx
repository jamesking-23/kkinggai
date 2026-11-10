"use client";

import { useEffect, useState } from "react";
import { fenToBoard } from "../lib/board";

/** Steps through a game's positions. Positions are computed on the server; this only renders them. */
export function ChessBoard({
  fens,
  sans,
  flip,
}: {
  fens: string[];
  sans: string[];
  flip: boolean;
}) {
  const [ply, setPly] = useState(0);
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

  const rows = fenToBoard(fens[ply] ?? fens[0]!);
  const ranks = flip ? [...rows].reverse().map((r) => [...r].reverse()) : rows;
  const files = flip ? "hgfedcba" : "abcdefgh";

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr]">
      <div>
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
        <p className="mt-1 text-xs text-muted">Files {files.split("").join(" ")} (bottom)</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => go(0)}
            className="rounded-md border border-border px-3 py-1 text-sm"
            aria-label="Start"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={() => go(ply - 1)}
            className="rounded-md border border-border px-3 py-1 text-sm"
            aria-label="Previous move"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => go(ply + 1)}
            className="rounded-md border border-border px-3 py-1 text-sm"
            aria-label="Next move"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => go(last)}
            className="rounded-md border border-border px-3 py-1 text-sm"
            aria-label="End"
          >
            ⏭
          </button>
        </div>
      </div>
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
                  className={`w-16 rounded px-1 text-left ${ply === idx + 1 ? "bg-primary text-white" : "hover:bg-border"}`}
                >
                  {sans[idx]}
                </button>
              ) : null,
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
