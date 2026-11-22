"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notificationReadSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { extractKinds, sanitizeKinds, withKinds, type PushKind } from "../../../lib/push-kinds";
import { extractQuiet, isValidTime, withQuiet } from "../../../lib/quiet-hours";
import type { Json } from "../../../lib/supabase/database.types";
import { isValidSubscription, sendPush, vapidConfigured } from "../../../lib/push";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/notifications";

export async function markRead(formData: FormData) {
  const parsed = notificationReadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .is("read_at", null);
  if (error) flash(PATH, "error", "Could not update the notification");
  revalidatePath(PATH);
  flash(PATH, "message", "Marked as read");
}

export async function markAllRead() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) flash(PATH, "error", "Could not update the notifications");
  revalidatePath(PATH);
  flash(PATH, "message", "All marked as read");
}

// ---- web push ----

type PushResult = { ok: boolean; message: string };

/** Saves this browser's push subscription for the signed-in user. */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<PushResult> {
  await getAppContext();
  const sub = {
    endpoint: String(input?.endpoint ?? ""),
    p256dh: String(input?.p256dh ?? ""),
    auth: String(input?.auth ?? ""),
  };
  if (!isValidSubscription(sub))
    return { ok: false, message: "This browser's push service is not supported." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
    p_user_agent: (await headers()).get("user-agent") ?? undefined,
  });
  if (error) return { ok: false, message: "Could not save the subscription. Try again." };
  return { ok: true, message: "Push notifications are on for this browser." };
}

/** Removes this browser's subscription. */
export async function removePushSubscription(endpoint: string): Promise<PushResult> {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("endpoint", String(endpoint ?? ""));
  return error
    ? { ok: false, message: "Could not turn push off. Try again." }
    : { ok: true, message: "Push notifications are off for this browser." };
}

/** Sends a test push to every device the user has registered, pruning any the push service says are gone. */
export async function sendTestPush(): Promise<PushResult> {
  const ctx = await getAppContext();
  if (!vapidConfigured())
    return { ok: false, message: "Push is not configured on the server yet." };
  const supabase = await createClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", ctx.userId)
    .limit(5);
  const subs = data ?? [];
  if (subs.length === 0)
    return { ok: false, message: "No device is registered. Turn push on first." };
  let delivered = 0;
  for (const s of subs) {
    const status = await sendPush(s, {
      title: "KKINGG AI test",
      body: "Push notifications work on this device.",
      url: "/notifications",
      tag: "test",
    });
    if (status >= 200 && status < 300) delivered++;
    else if (status === 404 || status === 410)
      await supabase.from("push_subscriptions").delete().eq("id", s.id);
  }
  return delivered > 0
    ? { ok: true, message: `Sent to ${delivered} of ${subs.length} device(s).` }
    : {
        ok: false,
        message: "The push service did not accept the test. Turn push off and on again.",
      };
}

/** The signed-in user's saved quiet hours, or null when none are set. */
export async function loadQuietHours(): Promise<{ from: string; to: string } | null> {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return extractQuiet(data?.settings);
}

/** Saves quiet hours (or clears them with null), keeping every other setting. Times are in the user's own timezone. */
export async function saveQuietHours(
  input: { from: string; to: string } | null,
): Promise<PushResult> {
  if (input !== null && (!isValidTime(input?.from) || !isValidTime(input?.to)))
    return { ok: false, message: "Use times like 22:00 and 07:00." };
  if (input !== null && input.from === input.to)
    return { ok: false, message: "Start and end must be different." };
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const { data: updated, error } = await supabase
    .from("user_settings")
    .update({ settings: withQuiet(data?.settings, input) as Json })
    .eq("user_id", ctx.userId)
    .select("user_id");
  if (error || !updated || updated.length === 0)
    return { ok: false, message: "Could not save quiet hours. Try again." };
  return {
    ok: true,
    message: input
      ? `Push is held back from ${input.from} to ${input.to} (${ctx.timezone}).`
      : "Quiet hours are off.",
  };
}

/** Kinds the signed-in user allows to push. All of them until the user changes it. */
export async function loadPushKinds(): Promise<PushKind[]> {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return extractKinds(data?.settings);
}

/** Saves which kinds may be pushed, keeping every other setting. Notifications still appear in the inbox either way. */
export async function savePushKinds(kinds: string[]): Promise<PushResult> {
  const clean = sanitizeKinds(kinds);
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const { data: updated, error } = await supabase
    .from("user_settings")
    .update({ settings: withKinds(data?.settings, clean) as Json })
    .eq("user_id", ctx.userId)
    .select("user_id");
  if (error || !updated || updated.length === 0)
    return { ok: false, message: "Could not save. Try again." };
  return {
    ok: true,
    message: clean.length === 0 ? "Nothing will be pushed." : "Saved.",
  };
}
