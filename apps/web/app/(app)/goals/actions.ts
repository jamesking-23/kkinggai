"use server";

import { revalidatePath } from "next/cache";
import { goalProgressSchema, goalSchema, milestoneSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/goals";

export async function createGoal(formData: FormData) {
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    workspace_id: ctx.current.id,
    title: parsed.data.title,
    target_value: parsed.data.targetValue ?? null,
    unit: parsed.data.unit ?? null,
    deadline: parsed.data.deadline ?? null,
  });
  if (error) flash(PATH, "error", "Could not create the goal");
  revalidatePath(PATH);
  flash(PATH, "message", "Goal created");
}

export async function updateGoalProgress(formData: FormData) {
  const parsed = goalProgressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ current_value: parsed.data.currentValue })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update progress");
  if (!data || data.length === 0)
    flash(PATH, "error", "This goal was changed elsewhere. Try again.");
  revalidatePath(PATH);
  flash(PATH, "message", "Progress saved");
}

export async function setGoalStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const revision = Number(formData.get("revision"));
  if (!["active", "achieved", "abandoned"].includes(status)) flash(PATH, "error", "Invalid status");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ status })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the goal");
  if (!data || data.length === 0)
    flash(PATH, "error", "This goal was changed elsewhere. Try again.");
  revalidatePath(PATH);
  flash(PATH, "message", "Goal updated");
}

export async function addMilestone(formData: FormData) {
  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").insert({
    workspace_id: ctx.current.id,
    goal_id: parsed.data.goalId,
    title: parsed.data.title,
    due_date: parsed.data.dueDate ?? null,
  });
  if (error) flash(PATH, "error", "Could not add the milestone");
  revalidatePath(PATH);
  flash(PATH, "message", "Milestone added");
}

export async function toggleMilestone(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "1";
  const supabase = await createClient();
  const { error } = await supabase
    .from("milestones")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) flash(PATH, "error", "Could not update the milestone");
  revalidatePath(PATH);
  flash(PATH, "message", done ? "Milestone completed" : "Milestone reopened");
}
