"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { fenToBoard } from "../lib/board";
import { legalTargets, moveWith, promotionChoices } from "../lib/puzzles";
import { pollIntervalMs } from "../lib/mp";
import { createClient } from "../lib/supabase/client";
import { Board, PieceIcon } from "./board";
import { playMove } from "../app/(app)/chess/play/actions";

const FILES = "abcdefgh";

/**
 * A playable board. Click a piece, then its destination (promotions become queens). The server checks the move again.
 * While the game is open the page listens for changes to it (Supabase realtime) and refreshes when one arrives, with a slow poll as a backup.
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
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);

  // Realtime: refresh as soon as the game row changes. Polling stays as a safety net.
  const [channel, setChannel] = useState<"subscribed" | "connecting" | "failed">("connecting");
  useEffect(() => {
    if (!waiting) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`mp-game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mp_games", filter: `id=eq.${gameId}` },
        () => router.refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setChannel("subscribed");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          setChannel("failed");
      });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [waiting, gameId, router]);

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, pollIntervalMs(channel));
    return () => clearInterval(t);
  }, [waiting, channel, router]);

  // A new position (after a move or a refresh) clears any half-made selection.
  useEffect(() => {
    setFrom(null);
    setPromo(null);
  }, [fen]);

  const flip = side === "black";
  const grid = fenToBoard(fen);
  const rows = flip ? [...grid].reverse().map((r) => [...r].reverse()) : grid;
  const sq = (r: number, c: number) => `${FILES[flip ? 7 - c : c]}${flip ? r + 1 : 8 - r}`;
  const mine = (glyph: string) =>
    side === "white" ? "♔♕♖♗♘♙".includes(glyph) : "♚♛♜♝♞♟".includes(glyph);

  function click(square: string, glyph: string) {
    if (!canMove || pending) return;
    if (promo) setPromo(null); // clicking elsewhere dismisses the promotion menu
    if (!from) {
      if (glyph && mine(glyph)) setFrom(square);
      return;
    }
    if (square === from) return setFrom(null);
    if (promotionChoices(fen, from, square).length > 0) {
      setPromo({ from, to: square }); // ask which piece before sending the move
      return;
    }
    const res = moveWith(fen, from, square);
    if (res) send(res.uci);
    else setFrom(glyph && mine(glyph) ? square : null);
  }

  function send(uci: string) {
    const fd = new FormData();
    fd.set("id", gameId);
    fd.set("uci", uci);
    setPromo(null);
    start(() => {
      void playMove(fd);
    });
  }

  const promoChoices = promo ? promotionChoices(fen, promo.from, promo.to) : [];

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
      after={
        promo && (
          <div
            className="surface-raised mt-3 rounded-xl p-3"
            role="dialog"
            aria-label="Choose a promotion piece"
          >
            <p className="mb-2 text-sm font-medium">Promote to</p>
            <div className="flex gap-2">
              {promoChoices.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(moveWith(fen, promo.from, promo.to, p)!.uci)}
                  aria-label={{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}
                  className="flex h-16 flex-1 items-center justify-center rounded-lg border border-border transition hover:border-primary hover:bg-bg"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <PieceIcon code={`${side === "white" ? "w" : "b"}${p.toUpperCase()}`} size={52} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPromo(null);
                  setFrom(null);
                }}
                className="rounded-lg border border-border px-3 text-sm text-muted hover:bg-bg"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }
    />
  );
}
