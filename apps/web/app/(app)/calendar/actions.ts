"use server";

import { revalidatePath } from "next/cache";
import { eventSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { zonedTimeToUtc } from "../../../lib/time";

const PATH = "/calendar";

export async function createEvent(formData: FormData) {
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const e = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    workspace_id: ctx.current.id,
    title: e.title,
    location: e.location ?? null,
    starts_at: zonedTimeToUtc(e.startsAt, ctx.timezone).toISOString(),
    ends_at: zonedTimeToUtc(e.endsAt, ctx.timezone).toISOString(),
  });
  if (error) flash(PATH, "error", "Could not create the event");
  revalidatePath(PATH);
  flash(PATH, "message", "Event added");
}

export async function deleteEvent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not delete the event");
  if (!data || data.length === 0)
    flash(PATH, "error", "This event was changed elsewhere. Try again.");
  revalidatePath(PATH);
  flash(PATH, "message", "Event deleted");
}
