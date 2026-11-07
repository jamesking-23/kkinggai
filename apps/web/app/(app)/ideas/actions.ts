"use server";

import { revalidatePath } from "next/cache";
import { ideaSchema, ideaStatusSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/ideas";

export async function captureIdea(formData: FormData) {
  const parsed = ideaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const i = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("idea_backlog").insert({
    workspace_id: ctx.current.id,
    title: i.title,
    description: i.description ?? "",
    category: i.category ?? null,
    priority: i.priority,
    related_module: i.relatedModule ?? null,
    notes: i.notes ?? "",
  });
  if (error) flash(PATH, "error", "Could not save the idea");
  revalidatePath(PATH);
  flash(PATH, "message", "Idea captured");
}

export async function setIdeaStatus(formData: FormData) {
  const parsed = ideaStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("idea_backlog")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the idea");
  if (!data || data.length === 0)
    flash(PATH, "error", "This idea was changed elsewhere. Try again.");
  revalidatePath(PATH);
  flash(PATH, "message", "Status updated");
}

export async function deleteIdea(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("idea_backlog")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not delete the idea");
  if (!data || data.length === 0)
    flash(PATH, "error", "This idea was changed elsewhere. Try again.");
  revalidatePath(PATH);
  flash(PATH, "message", "Idea deleted");
}
