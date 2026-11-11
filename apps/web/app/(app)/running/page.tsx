import { RUN_KINDS } from "@kkingg/schemas";
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
  type Totals,
} from "../../../lib/running";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../components/ui";
import { createRun, importGpx } from "./actions";

const total = (t: Totals) =>
  t.runs
    ? `${formatKm(t.distanceM)} · ${t.runs} run${t.runs === 1 ? "" : "s"} · ${formatDuration(t.movingSeconds)}`
    : "No runs";

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
  const runs = data ?? [];
  const sum = summariseRuns(runs, new Date(), ctx.timezone);
  const maxWeek = Math.max(1, ...sum.weeks.map((w) => w.distanceM));
  const today = localDate(new Date().toISOString(), ctx.timezone);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Running" subtitle="Your runs, routes and weekly volume." />
      <Flash error={error} message={message} />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card title="This week">
          <p className="text-sm">{total(sum.week)}</p>
        </Card>
        <Card title="This month">
          <p className="text-sm">{total(sum.month)}</p>
        </Card>
        <Card title="All time">
          <p className="text-sm">{total(sum.all)}</p>
        </Card>
      </div>

      {sum.all.runs > 0 && (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card title="Weekly distance">
            <ul className="space-y-1 text-xs">
              {sum.weeks.map((w) => (
                <li key={w.weekStart} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-muted">{w.weekStart.slice(5)}</span>
                  <span
                    className="h-2 rounded-sm bg-primary"
                    style={{ width: `${(w.distanceM / maxWeek) * 60}%` }}
                  />
                  <span className="text-muted">{w.runs ? formatKm(w.distanceM) : "–"}</span>
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
        <Card title="Import a GPX file">
          <form action={importGpx} className="space-y-2">
            <input
              type="file"
              name="file"
              accept=".gpx,application/gpx+xml,text/xml"
              required
              aria-label="GPX file"
              className="text-sm"
            />
            <input
              name="name"
              maxLength={200}
              placeholder="Name (optional)"
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
              GPX exports from Strava, Garmin, Samsung Health and most watches work if they include
              timestamps. Up to 4 MB. Distance, time and climb are calculated here, so they can
              differ slightly from your watch.
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
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm hover:bg-bg"
              >
                <span className="min-w-0">
                  <span className="block truncate">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {localDate(r.started_at, ctx.timezone)} · {KIND_LABELS[r.kind] ?? r.kind}
                    {r.source === "gpx" ? " · GPX" : ""}
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
