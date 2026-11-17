"use server";

import { revalidatePath } from "next/cache";
import { notificationReadSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
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
