"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNext } from "../../lib/safe-next";
import { createClient } from "../../lib/supabase/server";

/** Dismisses one of the user's own reminders (RLS restricts this to the owner) and returns to `back`. */
export async function dismissReminder(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = safeNext(String(formData.get("back") ?? "/"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/", "layout");
  redirect(error ? `${back}?error=${encodeURIComponent("Could not dismiss the reminder")}` : back);
}
