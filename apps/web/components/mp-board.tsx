"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { fenToBoard } from "../lib/board";
import { legalTargets, resolveClick } from "../lib/puzzles";
import { Board } from "./board";
import { playMove } from "../app/(app)/chess/play/actions";

const FILES = "abcdefgh";

/**
 * A playable board. Click a piece, then its destination (promotions become queens). The server checks the move again.
 * While the game is open and it is the opponent's turn the page refreshes every few seconds to pick up their move.
 */
export function MpBoard({
  gameId,
  fen,
  side,
  canMove,
  waiting,
  last,
}: {
  gameId: string;
  fen: string;
  side: "white" | "black";
  canMove: boolean;
  /** True while the game is open and the viewer should poll for changes. */
  waiting: boolean;
  last: { from: string; to: string } | null;
}) {
  const router = useRouter();
  const [from, setFrom] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [waiting, router]);

  // A new position (after a move or a refresh) clears any half-made selection.
  useEffect(() => setFrom(null), [fen]);

  const flip = side === "black";
  const grid = fenToBoard(fen);
  const rows = flip ? [...grid].reverse().map((r) => [...r].reverse()) : grid;
  const sq = (r: number, c: number) => `${FILES[flip ? 7 - c : c]}${flip ? r + 1 : 8 - r}`;
  const mine = (glyph: string) =>
    side === "white" ? "♔♕♖♗♘♙".includes(glyph) : "♚♛♜♝♞♟".includes(glyph);

  function click(square: string, glyph: string) {
    if (!canMove || pending) return;
    if (!from) {
      if (glyph && mine(glyph)) setFrom(square);
      return;
    }
    if (square === from) return setFrom(null);
    const res = resolveClick(fen, from, square, "");
    if (res) {
      const fd = new FormData();
      fd.set("id", gameId);
      fd.set("uci", res.uci);
      start(() => {
        void playMove(fd);
      });
    } else setFrom(glyph && mine(glyph) ? square : null);
  }

  return (
    <Board
      rows={rows}
      square={sq}
      label={`Chess board, you play ${side}`}
      onSquare={click}
      disabled={!canMove || pending}
      selected={from}
      last={last}
      targets={from ? legalTargets(fen, from) : undefined}
      busy={pending}
    />
  );
}
