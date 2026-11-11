"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { fenToBoard } from "../lib/board";
import { resolveClick } from "../lib/puzzles";
import { recordPuzzleAttempt } from "../app/(app)/chess/actions";

const FILES = "abcdefgh";

/** Click a piece, then a square. The answer is checked against the engine's best move saved with the puzzle. */
export function PuzzleBoard({
  id,
  revision,
  fen,
  solutionUci,
  side,
}: {
  id: string;
  revision: number;
  fen: string;
  solutionUci: string;
  side: "white" | "black";
}) {
  const [from, setFrom] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{ uci: string; san: string } | "reveal" | null>(null);
  const game = new Chess(fen);
  const flip = side === "black";
  const grid = fenToBoard(fen);
  const rows = flip ? [...grid].reverse().map((r) => [...r].reverse()) : grid;
  const sq = (r: number, c: number) => {
    const file = flip ? 7 - c : c;
    const rank = flip ? r + 1 : 8 - r;
    return `${FILES[file]}${rank}`;
  };
  const done = answer !== null;
  const move = answer && answer !== "reveal" ? answer.uci : "reveal";
  const correct = answer && answer !== "reveal" && answer.uci === solutionUci;

  function click(square: string) {
    if (done) return;
    const piece = game.get(square as never);
    if (!from) {
      if (piece && piece.color === (side === "white" ? "w" : "b")) setFrom(square);
      return;
    }
    if (square === from) return setFrom(null);
    const res = resolveClick(fen, from, square, solutionUci);
    if (res) {
      setAnswer(res);
      setFrom(null);
    } else if (piece && piece.color === (side === "white" ? "w" : "b")) setFrom(square);
    else setFrom(null);
  }

  return (
    <div>
      <div
        className="grid w-full max-w-[26rem] grid-cols-8 overflow-hidden rounded-md border border-border"
        role="group"
        aria-label={`Puzzle board, ${side} to move`}
      >
        {rows.flatMap((row, r) =>
          row.map((glyph, c) => {
            const s = sq(r, c);
            const dark = (r + c) % 2 === 1;
            return (
              <button
                key={s}
                type="button"
                onClick={() => click(s)}
                disabled={done}
                aria-label={`${s}${glyph ? ` ${glyph}` : ""}`}
                className={`flex aspect-square items-center justify-center text-3xl leading-none text-black sm:text-4xl ${
                  from === s ? "bg-yellow-300" : dark ? "bg-[#9c7a52]" : "bg-[#e8d9b8]"
                }`}
              >
                {glyph}
              </button>
            );
          }),
        )}
      </div>

      {!done ? (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span>{side === "white" ? "White" : "Black"} to move. Find the best move.</span>
          <button
            type="button"
            onClick={() => setAnswer("reveal")}
            className="rounded-md border border-border px-3 py-1"
          >
            Show answer
          </button>
        </div>
      ) : (
        <form action={recordPuzzleAttempt} className="mt-3 space-y-2 text-sm">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="revision" value={revision} />
          <input type="hidden" name="move" value={move} />
          <p className={correct ? "text-success" : "text-danger"}>
            {answer === "reveal"
              ? "Answer revealed. This counts as a miss."
              : correct
                ? `${(answer as { san: string }).san} is the engine's move.`
                : `${(answer as { san: string }).san} is not the engine's move.`}
          </p>
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-white">
            Record and continue
          </button>
        </form>
      )}
    </div>
  );
}
