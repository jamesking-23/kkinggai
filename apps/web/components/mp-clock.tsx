"use client";

import { useEffect, useState } from "react";
import { claimTimeout } from "../app/(app)/chess/play/actions";
import { formatClock } from "../lib/mp";
import { primaryButton } from "./ui";

/**
 * Shows both clocks. The remaining times come from the server at render time; the running side then counts down locally.
 * The countdown is only a display: the database decides who lost on time, either when the slow player moves or when the
 * opponent claims with the button below.
 */
export function MpClock({
  gameId,
  whiteMs,
  blackMs,
  running,
  viewer,
}: {
  gameId: string;
  whiteMs: number;
  blackMs: number;
  running: "w" | "b" | null;
  viewer: "white" | "black" | null;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (!running) return;
    const start = performance.now();
    const t = setInterval(() => setElapsed(performance.now() - start), 200);
    return () => clearInterval(t);
  }, [running, whiteMs, blackMs]);

  const w = Math.max(0, whiteMs - (running === "w" ? elapsed : 0));
  const b = Math.max(0, blackMs - (running === "b" ? elapsed : 0));
  const flagged = (running === "w" && w === 0) || (running === "b" && b === 0);
  const canClaim = flagged && viewer !== null && viewer !== (running === "w" ? "white" : "black");

  const cell = (label: string, ms: number, on: boolean) => (
    <div
      className={`rounded-md border px-3 py-1 font-mono text-lg ${on ? "border-primary" : "border-border"} ${ms < 10_000 && on ? "text-red-600" : ""}`}
      aria-label={`${label} clock`}
    >
      <span className="mr-2 text-xs text-muted">{label}</span>
      {formatClock(ms)}
    </div>
  );

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      {cell("White", w, running === "w")}
      {cell("Black", b, running === "b")}
      {canClaim && (
        <form action={claimTimeout}>
          <input type="hidden" name="id" value={gameId} />
          <button className={primaryButton}>Claim win on time</button>
        </form>
      )}
      {flagged && !canClaim && viewer !== null && <span className="text-sm">Out of time</span>}
    </div>
  );
}
