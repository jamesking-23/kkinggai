import { RUN_GOALS } from "@kkingg/schemas";
import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { dayDiff, GOALS, weeklyVolumes, type Goal } from "../../../../lib/plan";
import { formatKm, KIND_LABELS, localDate } from "../../../../lib/running";
import type { FlashParams } from "../../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { archivePlan, createPlan, removePlan, setSessionStatus } from "./actions";

export default async function PlanPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "running");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const today = localDate(new Date().toISOString(), ctx.timezone);

  const { data: plan } = await supabase
    .from("run_plans")
    .select("*")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: sessions }, { data: recent }] = await Promise.all([
    plan
      ? supabase
          .from("run_plan_sessions")
          .select("id, week, planned_on, kind, distance_m, description, status, revision")
          .eq("plan_id", plan.id)
          .order("planned_on", { ascending: true })
          .limit(400)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("run_activities")
      .select("started_at, distance_m, moving_seconds")
      .is("deleted_at", null)
      .gte("started_at", new Date(Date.now() - 28 * 86_400_000).toISOString())
      .limit(500),
  ]);
  const avgKm = Math.round((recent ?? []).reduce((a, r) => a + r.distance_m, 0) / 4 / 1000);

  const list = sessions ?? [];
  const weeks = [...new Set(list.map((s) => s.week))];
  const done = list.filter((s) => s.status === "done").length;
  const warnings = plan
    ? weeklyVolumes(plan.goal as Goal, plan.weeks, plan.start_weekly_km).warnings
    : [];
  const daysToRace = plan ? dayDiff(plan.race_date, today) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/running" className="text-primary">
          ← Running
        </a>
      </p>
      <PageHeader title="Training plan" subtitle="A rule-based plan toward a race." />
      <Flash error={error} message={message} />

      {plan ? (
        <>
          <Card title={plan.name} className="mb-4">
            <p className="text-sm">
              {GOALS[plan.goal as Goal]?.label} on {plan.race_date}
              {daysToRace >= 0
                ? ` · ${daysToRace} day${daysToRace === 1 ? "" : "s"} to go`
                : " · race date has passed"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {plan.weeks} weeks · {plan.days_per_week} runs a week · started from about{" "}
              {plan.start_weekly_km} km a week · {done} of {list.length} sessions done
            </p>
            {warnings.map((w) => (
              <p key={w} className="mt-2 text-xs text-warning">
                {w}
              </p>
            ))}
            <div className="mt-3 flex gap-2">
              <form action={archivePlan}>
                <input type="hidden" name="id" value={plan.id} />
                <input type="hidden" name="revision" value={plan.revision} />
                <button type="submit" className={subtleButton}>
                  Archive
                </button>
              </form>
              <form action={removePlan}>
                <input type="hidden" name="id" value={plan.id} />
                <input type="hidden" name="revision" value={plan.revision} />
                <button type="submit" className={subtleButton}>
                  Remove
                </button>
              </form>
            </div>
          </Card>

          <p className="mb-4 text-xs text-muted">
            This is a generic progression: a gradual build, a lighter week every 4th week and a
            taper. It does not know your injuries, terrain or pace, and it is not medical advice.
            Effort descriptions matter more than distances: adjust freely, and skip or shorten
            sessions when you are ill, hurt or very tired.
          </p>

          <div className="space-y-4">
            {weeks.map((w) => {
              const ws = list.filter((s) => s.week === w);
              const km = ws.reduce((a, s) => a + (s.kind === "race" ? 0 : s.distance_m), 0);
              const current =
                ws.some(
                  (s) => dayDiff(s.planned_on, today) >= 0 && dayDiff(s.planned_on, today) < 7,
                ) && ws[0]!.planned_on <= today;
              return (
                <Card key={w} title={`Week ${w} · ${formatKm(km)}${current ? " · this week" : ""}`}>
                  <ul className="space-y-3">
                    {ws.map((s) => (
                      <li key={s.id} className="text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={s.status === "done" ? "text-muted line-through" : ""}>
                              {new Date(`${s.planned_on}T00:00:00Z`).toLocaleDateString("en", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                timeZone: "UTC",
                              })}{" "}
                              · {KIND_LABELS[s.kind] ?? s.kind} · {formatKm(s.distance_m)}
                              {s.status === "skipped" ? " (skipped)" : ""}
                            </p>
                            <p className="text-xs text-muted">{s.description}</p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {(["done", "skipped", "planned"] as const)
                              .filter((st) => st !== s.status)
                              .map((st) => (
                                <form key={st} action={setSessionStatus}>
                                  <input type="hidden" name="id" value={s.id} />
                                  <input type="hidden" name="revision" value={s.revision} />
                                  <input type="hidden" name="status" value={st} />
                                  <button type="submit" className={subtleButton}>
                                    {st === "done" ? "Done" : st === "skipped" ? "Skip" : "Reset"}
                                  </button>
                                </form>
                              ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card title="Create a plan">
          <form action={createPlan} className="grid gap-2 sm:grid-cols-6">
            <select
              name="goal"
              defaultValue="10k"
              aria-label="Goal"
              className={`${inputClass} sm:col-span-3`}
            >
              {RUN_GOALS.map((g) => (
                <option key={g} value={g}>
                  {GOALS[g].label}
                </option>
              ))}
            </select>
            <input
              name="raceDate"
              type="date"
              required
              min={today}
              aria-label="Race date"
              className={`${inputClass} sm:col-span-3`}
            />
            <select
              name="daysPerWeek"
              defaultValue="4"
              aria-label="Runs per week"
              className={`${inputClass} sm:col-span-3`}
            >
              {[3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {d} runs a week
                </option>
              ))}
            </select>
            <input
              name="currentWeeklyKm"
              type="number"
              min="0"
              max="250"
              step="1"
              required
              defaultValue={avgKm}
              aria-label="Current weekly distance in km"
              className={`${inputClass} sm:col-span-3`}
            />
            <input
              name="name"
              maxLength={200}
              placeholder="Plan name (optional)"
              aria-label="Plan name"
              className={`${inputClass} sm:col-span-6`}
            />
            <p className="text-xs text-muted sm:col-span-6">
              Weekly distance is prefilled from your last 4 weeks of logged runs ({avgKm} km). Plans
              cover 4 to 24 weeks. Making a new plan archives the current one.
            </p>
            <button type="submit" className={`${primaryButton} sm:col-span-6`}>
              Create plan
            </button>
          </form>
        </Card>
      )}
      {!plan && <Empty>No active plan.</Empty>}
    </div>
  );
}
