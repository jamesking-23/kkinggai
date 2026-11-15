"use server";

import { revalidatePath } from "next/cache";
import { runPlanSchema, runSessionStatusSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../../lib/form";
import { generatePlan, GOALS } from "../../../../lib/plan";
import { localDate } from "../../../../lib/running";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";

const PATH = "/running/plan";
const STALE = "This was changed elsewhere. Reload and try again.";

export async function createPlan(formData: FormData) {
  const parsed = runPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const p = parsed.data;
  const ctx = await getAppContext();
  const today = localDate(new Date().toISOString(), ctx.timezone);
  const plan = generatePlan({
    goal: p.goal,
    raceDate: p.raceDate,
    today,
    daysPerWeek: p.daysPerWeek,
    currentWeeklyKm: p.currentWeeklyKm,
  });
  if ("error" in plan) flash(PATH, "error", plan.error);
  const generated = plan as Exclude<typeof plan, { error: string }>;

  const supabase = await createClient();
  // Keep the old plan's data: it is archived, not removed.
  await supabase
    .from("run_plans")
    .update({ status: "archived" })
    .eq("status", "active")
    .is("deleted_at", null);

  const { data: created, error } = await supabase
    .from("run_plans")
    .insert({
      name: p.name ?? `${GOALS[p.goal].label} on ${p.raceDate}`,
      goal: p.goal,
      race_date: p.raceDate,
      start_date: today,
      days_per_week: p.daysPerWeek,
      start_weekly_km: Math.round(p.currentWeeklyKm),
      weeks: generated.weeks,
    })
    .select("id")
    .single();
  if (error || !created) flash(PATH, "error", "Could not save the plan");

  const { error: sessErr } = await supabase.from("run_plan_sessions").insert(
    generated.sessions.map((s) => ({
      plan_id: created!.id,
      week: s.week,
      planned_on: s.date,
      kind: s.kind,
      distance_m: s.distanceM,
      description: s.description,
    })),
  );
  if (sessErr) {
    // Do not leave a plan with no sessions behind.
    await supabase
      .from("run_plans")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", created!.id);
    flash(PATH, "error", "Could not save the plan sessions");
  }
  revalidatePath("/running", "layout");
  flash(PATH, "message", "Plan created");
}

export async function setSessionStatus(formData: FormData) {
  const parsed = runSessionStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("run_plan_sessions")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the session");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Updated");
}

async function setPlan(
  formData: FormData,
  patch: { status?: "archived"; deleted_at?: string },
  done: string,
) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("run_plans")
    .update(patch)
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not update the plan");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath("/running", "layout");
  flash(PATH, "message", done);
}

export async function archivePlan(formData: FormData) {
  await setPlan(formData, { status: "archived" }, "Plan archived");
}

export async function removePlan(formData: FormData) {
  await setPlan(formData, { deleted_at: new Date().toISOString() }, "Plan removed");
}
