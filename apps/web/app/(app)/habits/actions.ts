"use server";

import { revalidatePath } from "next/cache";
import { habitSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { localDate } from "../../../lib/time";

const PATH = "/habits";

export async function createHabit(formData: FormData) {
  const parsed = habitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("habits").insert({
    workspace_id: ctx.current.id,
    name: parsed.data.name,
    cadence: parsed.data.cadence,
    target_per_period: parsed.data.targetPerPeriod,
  });
  if (error) flash(PATH, "error", "Could not create the habit");
  revalidatePath(PATH);
  flash(PATH, "message", "Habit added");
}

/** Logs today (in the user's time zone). The unique (habit, date) constraint makes repeats harmless. */
export async function logHabitToday(formData: FormData) {
  const habitId = String(formData.get("habitId") ?? "");
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("habit_logs").insert({
    workspace_id: ctx.current.id,
    habit_id: habitId,
    log_date: localDate(new Date(), ctx.timezone),
  });
  if (error && error.code !== "23505") flash(PATH, "error", "Could not log the habit");
  revalidatePath(PATH);
  flash(PATH, "message", error ? "Already logged today" : "Logged for today");
}

export async function undoHabitToday(formData: FormData) {
  const habitId = String(formData.get("habitId") ?? "");
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("habit_logs")
    .delete()
    .eq("habit_id", habitId)
    .eq("log_date", localDate(new Date(), ctx.timezone));
  if (error) flash(PATH, "error", "Could not undo the log");
  revalidatePath(PATH);
  flash(PATH, "message", "Today's log removed");
}

export async function archiveHabit(formData: FormData) {
  const habitId = String(formData.get("habitId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", habitId);
  if (error) flash(PATH, "error", "Could not archive the habit");
  revalidatePath(PATH);
  flash(PATH, "message", "Habit archived");
}
