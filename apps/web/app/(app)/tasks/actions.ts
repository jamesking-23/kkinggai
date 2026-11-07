"use server";

import { revalidatePath } from "next/cache";
import { taskSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { zonedTimeToUtc } from "../../../lib/time";

const PATH = "/tasks";

export async function createTask(formData: FormData) {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const t = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    workspace_id: ctx.current.id,
    title: t.title,
    priority: t.priority,
    category: t.category ?? null,
    project_id: t.projectId ?? null,
    // A due date means "by the end of that day" in the user's own time zone.
    due_at: t.dueDate ? zonedTimeToUtc(`${t.dueDate}T23:59`, ctx.timezone).toISOString() : null,
  });
  if (error) flash(PATH, "error", "Could not create the task");
  revalidatePath(PATH);
  flash(PATH, "message", "Task added");
}

/** Marks a task done or reopens it. `revision` guards against overwriting a newer edit. */
export async function toggleTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const done = formData.get("done") === "1";
  const ctx = await getAppContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the task");
  if (!data || data.length === 0) {
    flash(
      PATH,
      "error",
      "This task was changed elsewhere. The list has been refreshed — try again.",
    );
  }
  if (done) {
    await supabase.from("task_completions").insert({ workspace_id: ctx.current.id, task_id: id });
  }
  revalidatePath(PATH);
  flash(PATH, "message", done ? "Task completed" : "Task reopened");
}

/** Soft delete: sets a deletion marker so the record can still be synced and recovered. */
export async function deleteTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not delete the task");
  if (!data || data.length === 0) {
    flash(
      PATH,
      "error",
      "This task was changed elsewhere. The list has been refreshed — try again.",
    );
  }
  revalidatePath(PATH);
  flash(PATH, "message", "Task deleted");
}
