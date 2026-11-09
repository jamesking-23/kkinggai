"use server";

import { revalidatePath } from "next/cache";
import { careerProfileSchema, cvEntrySchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../../lib/form";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";

const PATH = "/career/profile";

export async function saveProfile(formData: FormData) {
  const parsed = careerProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const p = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("career_profiles").upsert({
    user_id: ctx.userId,
    headline: p.headline ?? "",
    summary: p.summary ?? "",
    location: p.location ?? null,
    website: p.website ?? null,
    linkedin_url: p.linkedinUrl ?? null,
    github_url: p.githubUrl ?? null,
  });
  if (error) flash(PATH, "error", "Could not save the profile");
  revalidatePath("/career", "layout");
  flash(PATH, "message", "Profile saved");
}

export async function addCvEntry(formData: FormData) {
  const parsed = cvEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const e = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("cv_entries").insert({
    kind: e.kind,
    title: e.title,
    organisation: e.organisation ?? null,
    location: e.location ?? null,
    start_date: e.startDate ?? null,
    end_date: e.endDate ?? null,
    description: e.description ?? "",
  });
  if (error) flash(PATH, "error", "Could not add the entry");
  revalidatePath("/career", "layout");
  flash(PATH, "message", "Entry added");
}

export async function deleteCvEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cv_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the entry");
  if (!data || data.length === 0)
    flash(PATH, "error", "This entry was changed elsewhere. Reload and try again.");
  revalidatePath("/career", "layout");
  flash(PATH, "message", "Entry removed");
}
