"use server";

import { revalidatePath } from "next/cache";
import { projectSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/projects";
const STATUSES = ["active", "paused", "completed", "archived"];

export async function createProject(formData: FormData) {
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    workspace_id: ctx.current.id,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    due_date: parsed.data.dueDate ?? null,
  });
  if (error) flash(PATH, "error", "Could not create the project");
  revalidatePath(PATH);
  flash(PATH, "message", "Project created");
}

export async function setProjectStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const revision = Number(formData.get("revision"));
  if (!STATUSES.includes(status)) flash(PATH, "error", "Invalid status");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the project");
  if (!data || data.length === 0)
    flash(PATH, "error", "This project was changed elsewhere. Try again.");
  revalidatePath(PATH);
  flash(PATH, "message", "Project updated");
}
