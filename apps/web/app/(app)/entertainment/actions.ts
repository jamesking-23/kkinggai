"use server";

import { revalidatePath } from "next/cache";
import { mediaSchema, mediaStatusSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { createClient } from "../../../lib/supabase/server";
import { localDate } from "../../../lib/time";

const PATH = "/entertainment";
const STALE = "This item was changed elsewhere. Reload and try again.";

export async function addMedia(formData: FormData) {
  const parsed = mediaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const m = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("media_items").insert({
    kind: m.kind,
    title: m.title,
    creator: m.creator ?? null,
    status: m.status,
    rating: m.rating ?? null,
    started_on: m.startedOn ?? null,
    finished_on: m.finishedOn ?? null,
    notes: m.notes ?? "",
    tags: m.tags,
  });
  if (error) flash(PATH, "error", "Could not save the item");
  revalidatePath(PATH);
  flash(PATH, "message", "Item added");
}

export async function setMediaStatus(formData: FormData) {
  const parsed = mediaStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const tz = String(formData.get("tz") ?? "UTC");
  const patch: { status: string; rating?: number; finished_on?: string } = {
    status: parsed.data.status,
  };
  if (parsed.data.rating) patch.rating = parsed.data.rating;
  // Finishing stamps today's date in the viewer's own time zone when none was recorded.
  if (parsed.data.status === "done" && formData.get("hasFinished") !== "1") {
    try {
      patch.finished_on = localDate(new Date(), tz);
    } catch {
      patch.finished_on = new Date().toISOString().slice(0, 10);
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the item");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Item updated");
}

export async function deleteMedia(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the item");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Item removed");
}
