"use server";

import { revalidatePath } from "next/cache";
import { reminderSchema, subtaskSchema, taskEditSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../../lib/form";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { zonedTimeToUtc } from "../../../../lib/time";

const STALE = "This task was changed elsewhere. Reload and try again.";

export async function updateTask(formData: FormData) {
  const parsed = taskEditSchema.safeParse(Object.fromEntries(formData));
  const rawId = String(formData.get("id") ?? "");
  if (!parsed.success) flash(`/tasks/${rawId}`, "error", firstIssue(parsed.error));
  const path = `/tasks/${parsed.data.id}`;
  const revision = Number(formData.get("revision"));
  const ctx = await getAppContext();
  const t = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: t.title,
      description: t.description ?? "",
      priority: t.priority,
      category: t.category ?? null,
      project_id: t.projectId ?? null,
      due_at: t.dueDate ? zonedTimeToUtc(`${t.dueDate}T23:59`, ctx.timezone).toISOString() : null,
    })
    .eq("id", t.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(path, "error", "Could not save the task");
  if (!data || data.length === 0) flash(path, "error", STALE);
  revalidatePath("/tasks");
  flash(path, "message", "Task saved");
}

export async function addSubtask(formData: FormData) {
  const parsed = subtaskSchema.safeParse(Object.fromEntries(formData));
  const rawId = String(formData.get("parentId") ?? "");
  if (!parsed.success) flash(`/tasks/${rawId}`, "error", firstIssue(parsed.error));
  const path = `/tasks/${parsed.data.parentId}`;
  const ctx = await getAppContext();
  const supabase = await createClient();

  const { data: parent } = await supabase
    .from("tasks")
    .select("project_id, parent_task_id")
    .eq("id", parsed.data.parentId)
    .eq("workspace_id", ctx.current.id)
    .maybeSingle();
  if (!parent) flash("/tasks", "error", "That task no longer exists");
  // Keep the tree one level deep so lists and dashboards stay simple.
  if (parent.parent_task_id) flash(path, "error", "Subtasks cannot have their own subtasks");

  const { error } = await supabase.from("tasks").insert({
    workspace_id: ctx.current.id,
    parent_task_id: parsed.data.parentId,
    project_id: parent.project_id,
    title: parsed.data.title,
  });
  if (error) flash(path, "error", "Could not add the subtask");
  revalidatePath(path);
  flash(path, "message", "Subtask added");
}

export async function toggleSubtask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const parentId = String(formData.get("parentId") ?? "");
  const revision = Number(formData.get("revision"));
  const done = formData.get("done") === "1";
  const path = `/tasks/${parentId}`;
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
  if (error) flash(path, "error", "Could not update the subtask");
  if (!data || data.length === 0) flash(path, "error", STALE);
  if (done) {
    await supabase.from("task_completions").insert({ workspace_id: ctx.current.id, task_id: id });
  }
  revalidatePath(path);
  flash(path, "message", done ? "Subtask completed" : "Subtask reopened");
}

export async function addReminder(formData: FormData) {
  const parsed = reminderSchema.safeParse(Object.fromEntries(formData));
  const rawId = String(formData.get("taskId") ?? "");
  if (!parsed.success) flash(`/tasks/${rawId}`, "error", firstIssue(parsed.error));
  const path = `/tasks/${parsed.data.taskId}`;
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").insert({
    workspace_id: ctx.current.id,
    target_type: "task",
    target_id: parsed.data.taskId,
    message: parsed.data.message,
    remind_at: zonedTimeToUtc(parsed.data.remindAt, ctx.timezone).toISOString(),
  });
  if (error) flash(path, "error", "Could not add the reminder");
  revalidatePath(path);
  flash(path, "message", "Reminder added");
}
