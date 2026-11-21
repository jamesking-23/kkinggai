"use client";

import { useEffect, useState } from "react";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "../app/(app)/notifications/actions";
import { urlBase64ToUint8Array } from "../lib/push-client";
import { primaryButton, subtleButton } from "./ui";

type State = "checking" | "unsupported" | "unconfigured" | "denied" | "off" | "on";

/** Turn browser push on or off for this device and send a test. Needs the VAPID public key from the server. */
export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        return setState("unsupported");
      if (!publicKey) return setState("unconfigured");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setNote(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        setNote("Permission was not granted.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const j = sub.toJSON();
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh ?? "",
        auth: j.keys?.auth ?? "",
      });
      setNote(res.message);
      if (res.ok) setState("on");
      else await sub.unsubscribe();
    } catch {
      setNote("Could not turn push on in this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setNote("Push notifications are off for this browser.");
    } catch {
      setNote("Could not turn push off.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setNote(null);
    try {
      setNote((await sendTestPush()).message);
    } catch {
      setNote("The test could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const text: Record<State, string> = {
    checking: "Checking this browser…",
    unsupported:
      "This browser does not support push. On iPhone, add the site to the Home Screen first (iOS 16.4 or later).",
    unconfigured: "Push is not set up on the server yet.",
    denied:
      "Notifications are blocked for this site. Allow them in the browser settings, then reload.",
    off: "Get a notification on this device when something you track is coming up.",
    on: "Push is on for this browser.",
  };

  return (
    <div>
      <p className="text-sm text-muted">{text[state]}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {state === "off" && (
          <button type="button" disabled={busy} onClick={enable} className={primaryButton}>
            Turn on push
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" disabled={busy} onClick={test} className={primaryButton}>
              Send a test
            </button>
            <button type="button" disabled={busy} onClick={disable} className={subtleButton}>
              Turn off
            </button>
          </>
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
