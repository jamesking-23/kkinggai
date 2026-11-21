"use client";

import { useState } from "react";
import { saveQuietHours } from "../app/(app)/notifications/actions";
import { primaryButton, subtleButton } from "./ui";

/** Choose hours when push is held back. Notifications still appear in the inbox. Times are in the account timezone. */
export function QuietHoursForm({
  initial,
  timezone,
}: {
  initial: { from: string; to: string } | null;
  timezone: string;
}) {
  const [from, setFrom] = useState(initial?.from ?? "22:00");
  const [to, setTo] = useState(initial?.to ?? "07:00");
  const [active, setActive] = useState(initial !== null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(value: { from: string; to: string } | null) {
    setBusy(true);
    setNote(null);
    try {
      const res = await saveQuietHours(value);
      setNote(res.message);
      if (res.ok) setActive(value !== null);
    } catch {
      setNote("Could not save quiet hours.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-sm font-medium">Quiet hours</p>
      <p className="mt-1 text-sm text-muted">
        Hold push back between these times ({timezone}). Anything that arrives meanwhile still shows
        here, and is pushed afterwards if it is less than a day old.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted">
          From
          <input
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-bg/80 px-2 py-1 text-sm text-text"
          />
        </label>
        <label className="text-xs text-muted">
          To
          <input
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-bg/80 px-2 py-1 text-sm text-text"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ from, to })}
          className={primaryButton}
        >
          {active ? "Update" : "Turn on"}
        </button>
        {active && (
          <button type="button" disabled={busy} onClick={() => run(null)} className={subtleButton}>
            Turn off
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="mt-2 text-xs text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
