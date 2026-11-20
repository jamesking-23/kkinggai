"use client";

import { useState } from "react";
import { fenToBoard } from "../lib/board";
import { legalTargets, moveWith } from "../lib/puzzles";
import { formatPath, scorePercent, type RepPosition } from "../lib/repertoire-format";
import { Board } from "./board";

const FILES = "abcdefgh";

type Answer = { uci: string; san: string } | "reveal";

/** Shows a position from the user's own games and asks for their usual move; then shows what they actually played. */
export function RepertoireDrill({ positions }: { positions: RepPosition[] }) {
  const [i, setI] = useState(0);
  const [from, setFrom] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [tally, setTally] = useState({ main: 0, other: 0, unknown: 0 });

  const pos = positions[i % positions.length]!;
  const flip = pos.color === "black";
  const grid = fenToBoard(pos.fen);
  const rows = flip ? [...grid].reverse().map((r) => [...r].reverse()) : grid;
  const sq = (r: number, c: number) => `${FILES[flip ? 7 - c : c]}${flip ? r + 1 : 8 - r}`;
  const mine = (g: string) => (pos.color === "white" ? "♔♕♖♗♘♙" : "♚♛♜♝♞♟").includes(g);
  const main = pos.moves[0]!;

  function click(square: string, glyph: string) {
    if (answer) return;
    if (!from) {
      if (glyph && mine(glyph)) setFrom(square);
      return;
    }
    if (square === from) return setFrom(null);
    const m = moveWith(pos.fen, from, square, "q");
    if (!m) return setFrom(glyph && mine(glyph) ? square : null);
    setAnswer(m);
    setFrom(null);
    const hit = pos.moves.find((x) => x.uci === m.uci);
    setTally((t) =>
      hit === main
        ? { ...t, main: t.main + 1 }
        : hit
          ? { ...t, other: t.other + 1 }
          : { ...t, unknown: t.unknown + 1 },
    );
  }

  function next() {
    setAnswer(null);
    setFrom(null);
    setI((n) => n + 1);
  }

  const chosen = answer && answer !== "reveal" ? pos.moves.find((x) => x.uci === answer.uci) : null;
  const verdict =
    answer === null
      ? null
      : answer === "reveal"
        ? `Your usual move here is ${main.san}.`
        : chosen === main
          ? `Yes, ${main.san} is your main move here.`
          : chosen
            ? `You have played ${chosen.san} here too, but your main move is ${main.san}.`
            : `You have not played ${answer.san} here. Your main move is ${main.san}.`;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[auto_1fr]">
      <Board
        rows={rows}
        square={sq}
        label={`Position ${i + 1}, you play ${pos.color}`}
        onSquare={click}
        disabled={answer !== null}
        selected={from}
        targets={from ? legalTargets(pos.fen, from) : undefined}
        animate={false}
      />
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            Position {(i % positions.length) + 1} of {positions.length} · you play {pos.color}
          </p>
          <p className="mt-1 text-sm">
            After <span className="font-medium">{formatPath(pos.path)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">Reached in {pos.total} of your games.</p>
        </div>

        {answer === null ? (
          <>
            <p className="text-sm">What do you usually play here? Click a piece, then a square.</p>
            <button
              type="button"
              onClick={() => {
                setAnswer("reveal");
                setFrom(null);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:bg-raised hover:text-text"
            >
              Show my moves
            </button>
          </>
        ) : (
          <>
            <p
              role="status"
              className={`text-sm font-medium ${
                answer !== "reveal" && chosen === main ? "text-success" : ""
              }`}
            >
              {verdict}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-1 font-normal">Move</th>
                  <th className="pb-1 font-normal">Played</th>
                  <th className="pb-1 font-normal">Score</th>
                  <th className="pb-1 font-normal">W / D / L</th>
                </tr>
              </thead>
              <tbody>
                {pos.moves.slice(0, 6).map((m) => {
                  const s = scorePercent(m);
                  return (
                    <tr key={m.uci} className="border-t border-border">
                      <td className="py-1.5 font-medium">{m.san}</td>
                      <td className="py-1.5 tabular-nums">
                        {m.count} ({Math.round((m.count / pos.total) * 100)}%)
                      </td>
                      <td className="py-1.5 tabular-nums">{s === null ? "–" : `${s}%`}</td>
                      <td className="py-1.5 tabular-nums text-muted">
                        {m.wins} / {m.draws} / {m.losses}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              onClick={next}
              className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white"
            >
              Next position
            </button>
          </>
        )}

        <p className="text-xs text-muted">
          This session: {tally.main} main move · {tally.other} other known move · {tally.unknown}{" "}
          new move
        </p>
      </div>
    </div>
  );
}
