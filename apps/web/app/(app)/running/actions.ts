"use server";

import { revalidatePath } from "next/cache";
import {
  RUN_IMPORT_MAX_FILES,
  RUN_MAX_GPX_BYTES,
  runEditSchema,
  runGpxSchema,
  runManualSchema,
} from "@kkingg/schemas";
import { trackKey, trackStats } from "../../../lib/gpx";
import { averageHr, parseTrackFile } from "../../../lib/trackfile";
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
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) flash(PATH, "error", "Choose at least one GPX or TCX file");
  if (files.length > RUN_IMPORT_MAX_FILES)
    flash(PATH, "error", `Upload at most ${RUN_IMPORT_MAX_FILES} files at a time`);
  if (files.reduce((n, f) => n + f.size, 0) > RUN_MAX_GPX_BYTES)
    flash(PATH, "error", "Those files add up to more than 4 MB. Upload fewer at a time");

  const supabase = await createClient();
  const origin = meta.data!.origin;
  let imported = 0;
  let lastId: string | null = null;
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const f of files) {
    const parsed = parseTrackFile(f.name, new Uint8Array(await f.arrayBuffer()));
    if ("error" in parsed) {
      failed.push(`${f.name}: ${parsed.error}`);
      continue;
    }
    const { track } = parsed;
    const stats = trackStats(track.points);
    if ("error" in stats) {
      failed.push(`${f.name}: ${stats.error}`);
      continue;
    }
    const key = trackKey(track.points);
    // The same workout is a duplicate whichever site it came from.
    const { data: have } = await supabase
      .from("run_activities")
      .select("id")
      .eq("external_id", key)
      .is("deleted_at", null)
      .limit(1);
    if (have?.length) {
      skipped.push(f.name);
      continue;
    }
    const { data, error } = await supabase
      .from("run_activities")
      .insert({
        source: origin,
        external_id: key,
        // A name typed in the form only makes sense for a single file.
        name: (files.length === 1 ? meta.data!.name : undefined) ?? track.name ?? "Run",
        kind: meta.data!.kind,
        started_at: stats.startedAt.toISOString(),
        distance_m: stats.distanceM,
        moving_seconds: stats.movingSeconds,
        elapsed_seconds: stats.elapsedSeconds,
        elevation_gain_m: stats.elevationGainM,
        avg_hr: averageHr(track.points),
        route: stats.route,
      })
      .select("id")
      .single();
    if (error || !data) {
      failed.push(`${f.name}: could not save`);
      continue;
    }
    imported++;
    lastId = data.id;
  }

  revalidatePath(PATH);
  const parts = [`${imported} imported`];
  if (skipped.length) parts.push(`${skipped.length} already in your history`);
  if (failed.length) parts.push(`${failed.length} failed (${failed.join("; ").slice(0, 400)})`);
  const text = parts.join(", ");
  if (imported === 0) flash(PATH, "error", text);
  if (imported === 1 && !skipped.length && !failed.length)
    flash(`${PATH}/${lastId}`, "message", "Run imported");
  flash(PATH, failed.length ? "error" : "message", text);
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
