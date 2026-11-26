"use server";

import { revalidatePath } from "next/cache";
import { taskSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { copyAttachments } from "../../../lib/copy-attachments";
import { nextDueDate, ruleFor } from "../../../lib/recurrence";
import { localDate, zonedTimeToUtc } from "../../../lib/time";

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
    recurrence_rule: t.repeat ? ruleFor(t.repeat) : null,
    // A due date means "by the end of that day" in the user's own time zone.
    due_at: t.dueDate ? zonedTimeToUtc(`${t.dueDate}T23:59`, ctx.timezone).toISOString() : null,
  });
  if (error) flash(PATH, "error", "Could not create the task");
  revalidatePath(PATH);
  flash(PATH, "message", "Task added");
}

/**
 * Marks a task done or reopens it. `revision` guards against overwriting a newer edit. Completing a recurring task also
 * creates its next copy (see complete_task), due on the next occurrence that is not already in the past.
 */
export async function toggleTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const done = formData.get("done") === "1";
  const ctx = await getAppContext();
  const supabase = await createClient();

  if (done) {
    const { data: task } = await supabase
      .from("tasks")
      .select("recurrence_rule, due_at")
      .eq("id", id)
      .maybeSingle();
    let nextDue: string | null = null;
    if (task?.recurrence_rule) {
      const next = nextDueDate(
        task.recurrence_rule,
        task.due_at ? localDate(task.due_at, ctx.timezone) : null,
        localDate(new Date(), ctx.timezone),
      );
      if (next) nextDue = zonedTimeToUtc(`${next}T23:59`, ctx.timezone).toISOString();
    }
    const { data: created, error } = await supabase.rpc("complete_task", {
      task_id: id,
      expected_revision: revision,
      next_due: nextDue,
    });
    if (error) {
      flash(
        PATH,
        "error",
        error.message.includes("changed elsewhere")
          ? "This task was changed elsewhere. The list has been refreshed — try again."
          : "Could not update the task",
      );
    }
    if (created) await copyAttachments(supabase, ctx.current.id, id, String(created));
    revalidatePath(PATH);
    flash(
      PATH,
      "message",
      created ? "Task completed. The next one is scheduled" : "Task completed",
    );
  }

  const { data: removed, error } = await supabase.rpc("reopen_task", {
    task_id: id,
    expected_revision: revision,
  });
  if (error) {
    flash(
      PATH,
      "error",
      error.message.includes("changed elsewhere")
        ? "This task was changed elsewhere. The list has been refreshed — try again."
        : "Could not update the task",
    );
  }
  revalidatePath(PATH);
  flash(
    PATH,
    "message",
    removed ? "Task reopened. The copy that was scheduled has been removed" : "Task reopened",
  );
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
