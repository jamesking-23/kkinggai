import { RUN_IMPORT_MAX_FILES, RUN_KINDS } from "@kkingg/schemas";
import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import {
  formatDuration,
  formatKm,
  formatPace,
  KIND_LABELS,
  localDate,
  paceSecPerKm,
  summariseRuns,
} from "../../../lib/running";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  StatTile,
  subtleButton,
} from "../../../components/ui";
import { weeklyZones, ZONES } from "../../../lib/hrzones";
import { createRun, importGpx, saveMaxHr } from "./actions";

const ZONE_COLORS = ["#4f7cff", "#2fb4c9", "#3cc47a", "#f0b429", "#ef5b5b"];

const SOURCE_LABELS: Record<string, string> = {
  gpx: "Imported",
  strava: "Strava",
  mapmyrun: "MapMyRun",
};

export default async function RunningPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "running");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("run_activities")
    .select("id, name, kind, started_at, distance_m, moving_seconds, elevation_gain_m, source")
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(2000);
  const { data: profile } = await supabase.from("run_profiles").select("max_hr").maybeSingle();
  const since = new Date(Date.now() - 70 * 86400_000).toISOString();
  const { data: hrRuns } = profile?.max_hr
    ? await supabase
        .from("run_activities")
        .select("started_at, hr_buckets")
        .not("hr_buckets", "is", null)
        .gte("started_at", since)
        .is("deleted_at", null)
        .limit(500)
    : { data: [] };
  const zoneWeeks = profile?.max_hr
    ? weeklyZones(hrRuns ?? [], profile.max_hr, new Date(), ctx.timezone)
    : [];
  const zoneMax = Math.max(1, ...zoneWeeks.map((w) => w.total));
  const runs = data ?? [];
  const sum = summariseRuns(runs, new Date(), ctx.timezone);
  const maxWeek = Math.max(1, ...sum.weeks.map((w) => w.distanceM));
  const today = localDate(new Date().toISOString(), ctx.timezone);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Running" subtitle="Your runs, routes and weekly volume." />
      <Flash error={error} message={message} />

      <p className="mb-6 flex gap-4 text-sm">
        <a href="/running/plan" className="text-primary">
          Training plan
        </a>
        <a href="/running/coach" className="text-primary">
          Running coach
        </a>
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(
          [
            ["This week", sum.week],
            ["This month", sum.month],
            ["All time", sum.all],
          ] as const
        ).map(([label, t]) => (
          <StatTile
            key={label}
            label={label}
            value={t.runs ? formatKm(t.distanceM) : "–"}
            hint={
              t.runs
                ? `${t.runs} run${t.runs === 1 ? "" : "s"} · ${formatDuration(t.movingSeconds)}`
                : "No runs"
            }
          />
        ))}
      </div>

      {sum.all.runs > 0 && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card title="Weekly distance">
            <ul className="flex h-36 items-end gap-1.5" aria-label="Distance per week">
              {sum.weeks.map((w) => (
                <li
                  key={w.weekStart}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  title={`${w.weekStart}: ${w.runs ? formatKm(w.distanceM) : "no runs"}`}
                >
                  <span className="text-[10px] text-muted">
                    {w.runs ? (w.distanceM / 1000).toFixed(0) : ""}
                  </span>
                  <span
                    className="w-full rounded-t-md"
                    style={{
                      height: `${Math.max(w.runs ? 4 : 1, (w.distanceM / maxWeek) * 100)}%`,
                      background: w.runs ? "var(--brand-gradient)" : "var(--color-border)",
                    }}
                  />
                  <span className="text-[10px] text-muted">{w.weekStart.slice(5)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Weeks start on Monday ({ctx.timezone}).</p>
          </Card>
          <Card title="Fastest average pace">
            {sum.bests.length ? (
              <ul className="space-y-1 text-sm">
                {sum.bests.map((b) => (
                  <li key={b.km} className="flex justify-between">
                    <span>
                      Runs of{" "}
                      {b.km >= 42 ? "marathon+" : b.km >= 21 ? "half marathon+" : `${b.km} km+`}
                    </span>
                    <span>{formatPace(b.secPerKm)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Log a run of 5 km or more.</p>
            )}

            {zoneWeeks.some((w) => w.total > 0) && (
              <Card title="Time in heart-rate zones, by week" className="mb-6">
                <ul className="space-y-2" aria-label="Time in each zone per week">
                  {[...zoneWeeks].reverse().map((w) => (
                    <li key={w.weekStart} className="flex items-center gap-3 text-xs">
                      <span className="w-12 shrink-0 text-muted">{w.weekStart.slice(5)}</span>
                      <span
                        className="flex h-3 overflow-hidden rounded-full bg-raised"
                        style={{ width: `${Math.max(2, (w.total / zoneMax) * 100)}%` }}
                        title={ZONES.map(
                          (z, i) => `${z.label}: ${formatDuration(Math.round(w.seconds[i]!))}`,
                        ).join("\n")}
                      >
                        {w.seconds.map((sec, i) =>
                          sec > 0 ? (
                            <span
                              key={i}
                              style={{
                                width: `${(sec / w.total) * 100}%`,
                                background: ZONE_COLORS[i],
                              }}
                            />
                          ) : null,
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {w.total > 0 ? formatDuration(Math.round(w.total)) : "–"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {ZONES.map((z, i) => (
                    <span key={z.id} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: ZONE_COLORS[i] }}
                      />
                      {z.label}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Last 8 weeks, runs with heart-rate data only, using a maximum of {profile?.max_hr}{" "}
                  bpm.
                </p>
              </Card>
            )}

            <p className="mt-2 text-xs text-muted">
              Average pace over a whole run, not a split-based personal best.
            </p>
          </Card>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card title="Add a run">
          <form action={createRun} className="grid gap-2 sm:grid-cols-6">
            <input
              name="name"
              required
              maxLength={200}
              placeholder="Name"
              aria-label="Name"
              className={`${inputClass} sm:col-span-4`}
            />
            <select
              name="kind"
              defaultValue="easy"
              aria-label="Type"
              className={`${inputClass} sm:col-span-2`}
            >
              {RUN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <input
              name="date"
              type="date"
              required
              defaultValue={today}
              max={today}
              aria-label="Date"
              className={`${inputClass} sm:col-span-3`}
            />
            <input
              name="distanceKm"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Distance (km)"
              aria-label="Distance in km"
              className={`${inputClass} sm:col-span-3`}
            />
            <input
              name="hours"
              type="number"
              min="0"
              max="99"
              placeholder="h"
              aria-label="Hours"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              name="minutes"
              type="number"
              min="0"
              max="59"
              placeholder="min"
              aria-label="Minutes"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              name="seconds"
              type="number"
              min="0"
              max="59"
              placeholder="sec"
              aria-label="Seconds"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              name="elevationGain"
              type="number"
              min="0"
              placeholder="Climb (m)"
              aria-label="Elevation gain in metres"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              name="avgHr"
              type="number"
              min="30"
              max="250"
              placeholder="Avg HR"
              aria-label="Average heart rate"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              name="effort"
              type="number"
              min="1"
              max="10"
              placeholder="Effort 1-10"
              aria-label="Effort from 1 to 10"
              className={`${inputClass} sm:col-span-2`}
            />
            <button type="submit" className={`${primaryButton} sm:col-span-6`}>
              Add run
            </button>
          </form>
        </Card>
        <Card title="Heart-rate zones">
          <form action={saveMaxHr} className="flex flex-wrap items-center gap-2">
            <input
              name="maxHr"
              type="number"
              inputMode="numeric"
              min={100}
              max={230}
              required
              defaultValue={profile?.max_hr ?? ""}
              placeholder="Max heart rate (bpm)"
              aria-label="Maximum heart rate"
              className={`${inputClass} max-w-[14rem]`}
            />
            <button type="submit" className={subtleButton}>
              Save
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">
            Used to split imported runs that have heart-rate data into five zones. Use a value from
            a hard test or race effort if you have one; a rough guess is 220 minus your age.
          </p>
        </Card>
        <Card title="Import workouts">
          <form action={importGpx} className="space-y-2">
            <input
              type="file"
              name="file"
              multiple
              accept=".gpx,.tcx,.gz,application/gpx+xml,text/xml"
              required
              aria-label="Workout files"
              className="text-sm"
            />
            <select
              name="origin"
              defaultValue="strava"
              aria-label="Exported from"
              className={inputClass}
            >
              <option value="strava">Exported from Strava</option>
              <option value="mapmyrun">Exported from MapMyRun</option>
              <option value="gpx">Other (Garmin, Samsung, watch)</option>
            </select>
            <input
              name="name"
              maxLength={200}
              placeholder="Name (optional, single file only)"
              aria-label="Name"
              className={inputClass}
            />
            <select name="kind" defaultValue="easy" aria-label="Type" className={inputClass}>
              {RUN_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              Upload .gpx or .tcx files (also .gpx.gz / .tcx.gz from Strava&apos;s bulk export), up
              to {RUN_IMPORT_MAX_FILES} files and 4 MB in total per upload. FIT files are not
              supported. Files need timestamps. Distance, time and climb are calculated here, so
              they can differ slightly from the app. Uploading a workout twice is skipped.
            </p>
            <button type="submit" className={subtleButton}>
              Import
            </button>
          </form>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-medium">Activities ({runs.length})</h2>
      {runs.length ? (
        <ul className="space-y-2">
          {runs.slice(0, 100).map((r) => (
            <li key={r.id}>
              <a
                href={`/running/${r.id}`}
                className="flex items-center justify-between gap-3 row-card rounded-xl border border-border px-4 py-3 text-sm hover:bg-bg"
              >
                <span className="min-w-0">
                  <span className="block truncate">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {localDate(r.started_at, ctx.timezone)} · {KIND_LABELS[r.kind] ?? r.kind}
                    {SOURCE_LABELS[r.source] ? ` · ${SOURCE_LABELS[r.source]}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  {formatKm(r.distance_m)}
                  <span className="block text-muted">
                    {formatDuration(r.moving_seconds)} ·{" "}
                    {formatPace(paceSecPerKm(r.distance_m, r.moving_seconds))}
                  </span>
                </span>
              </a>
            </li>
          ))}
          {runs.length > 100 && <li className="text-xs text-muted">Showing the latest 100.</li>}
        </ul>
      ) : (
        <Empty>No runs yet. Add one above or import a GPX file.</Empty>
      )}
    </div>
  );
}
