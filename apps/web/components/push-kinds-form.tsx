"use client";

import { useState } from "react";
import { savePushKinds } from "../app/(app)/notifications/actions";
import { PUSH_KINDS } from "../lib/push-kinds";
import { primaryButton } from "./ui";

/** Choose which kinds of notification are pushed to your devices. The inbox always shows all of them. */
export function PushKindsForm({ initial }: { initial: string[] }) {
  const [on, setOn] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function toggle(id: string) {
    setOn((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      setNote((await savePushKinds(on)).message);
    } catch {
      setNote("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-sm font-medium">What to push</p>
      <p className="mt-1 text-sm text-muted">
        Untick a kind to stop pushing it. It still appears in the list below.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {PUSH_KINDS.map((k) => (
          <label key={k.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={on.includes(k.id)} onChange={() => toggle(k.id)} />
            {k.label}
          </label>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={save} className={`${primaryButton} mt-3`}>
        Save
      </button>
      {note && (
        <p role="status" className="mt-2 text-xs text-muted">
          {note}
        </p>
      )}
    </div>
  );
}
