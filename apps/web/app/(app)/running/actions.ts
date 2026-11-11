"use server";

import { revalidatePath } from "next/cache";
import { RUN_MAX_GPX_BYTES, runEditSchema, runGpxSchema, runManualSchema } from "@kkingg/schemas";
import { parseGpx, trackKey, trackStats } from "../../../lib/gpx";
import { firstIssue, flash } from "../../../lib/form";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/running";
const STALE = "This activity was changed elsewhere. Reload and try again.";

export async function createRun(formData: FormData) {
  const parsed = runManualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const r = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("run_activities").insert({
    source: "manual",
    name: r.name,
    kind: r.kind,
    // Noon UTC keeps the entered calendar day in every time zone from UTC-12 to UTC+11.
    started_at: `${r.date}T12:00:00Z`,
    distance_m: Math.round(r.distanceKm * 1000),
    moving_seconds: r.hours * 3600 + r.minutes * 60 + r.seconds,
    elevation_gain_m: r.elevationGain ?? null,
    avg_hr: r.avgHr ?? null,
    effort: r.effort ?? null,
    notes: r.notes ?? "",
  });
  if (error) flash(PATH, "error", "Could not save the run");
  revalidatePath(PATH);
  flash(PATH, "message", "Run added");
}

export async function importGpx(formData: FormData) {
  const meta = runGpxSchema.safeParse(Object.fromEntries(formData));
  if (!meta.success) flash(PATH, "error", firstIssue(meta.error));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) flash(PATH, "error", "Choose a .gpx file");
  const f = file as File;
  if (f.size > RUN_MAX_GPX_BYTES) flash(PATH, "error", "That file is larger than 4 MB");

  const track = parseGpx(await f.text());
  const stats = trackStats(track.points);
  if ("error" in stats) flash(PATH, "error", stats.error);
  const s = stats as Exclude<typeof stats, { error: string }>;
  const key = trackKey(track.points);

  const supabase = await createClient();
  const { data: have } = await supabase
    .from("run_activities")
    .select("id")
    .eq("source", "gpx")
    .eq("external_id", key)
    .is("deleted_at", null)
    .maybeSingle();
  if (have) flash(PATH, "error", "That run is already in your history");

  const { data, error } = await supabase
    .from("run_activities")
    .insert({
      source: "gpx",
      external_id: key,
      name: meta.data!.name ?? track.name ?? "Run",
      kind: meta.data!.kind,
      started_at: s.startedAt.toISOString(),
      distance_m: s.distanceM,
      moving_seconds: s.movingSeconds,
      elapsed_seconds: s.elapsedSeconds,
      elevation_gain_m: s.elevationGainM,
      route: s.route,
    })
    .select("id")
    .single();
  if (error || !data) flash(PATH, "error", "Could not save the run");
  revalidatePath(PATH);
  flash(`${PATH}/${data!.id}`, "message", "Run imported");
}

export async function saveRunEdit(formData: FormData) {
  const parsed = runEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const path = `${PATH}/${parsed.data.id}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("run_activities")
    .update({
      name: parsed.data.name,
      kind: parsed.data.kind,
      effort: parsed.data.effort ?? null,
      notes: parsed.data.notes,
    })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(path, "error", "Could not save changes");
  if (!data || data.length === 0) flash(path, "error", STALE);
  revalidatePath(path);
  flash(path, "message", "Saved");
}

export async function deleteRun(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("run_activities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the run");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Run removed");
}
