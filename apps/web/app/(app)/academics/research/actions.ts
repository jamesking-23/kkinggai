"use server";

import { revalidatePath } from "next/cache";
import { researchSourceSchema, researchStatusSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../../lib/form";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";

const PATH = "/academics/research";
const STALE = "This source was changed elsewhere. Reload and try again.";

export async function addSource(formData: FormData) {
  const parsed = researchSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const s = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("research_sources").insert({
    workspace_id: ctx.current.id,
    title: s.title,
    authors: s.authors ?? null,
    published_year: s.publishedYear ?? null,
    kind: s.kind,
    url: s.url ?? null,
    summary: s.summary ?? "",
    course_id: s.courseId ?? null,
    tags: s.tags,
  });
  if (error) flash(PATH, "error", "Could not save the source");
  revalidatePath(PATH);
  flash(PATH, "message", "Source added");
}

export async function setSourceStatus(formData: FormData) {
  const parsed = researchStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_sources")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the source");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Status updated");
}

export async function deleteSource(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_sources")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the source");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Source removed");
}
