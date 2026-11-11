import { notFound } from "next/navigation";
import { RUN_KINDS } from "@kkingg/schemas";
import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import {
  formatDuration,
  formatKm,
  formatPace,
  KIND_LABELS,
  paceSecPerKm,
  routeToSvg,
} from "../../../../lib/running";
import type { FlashParams } from "../../../../lib/form";
import {
  Card,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { deleteRun, saveRunEdit } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toRoute(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (p): p is [number, number] =>
      Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number",
  );
}

export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "running");
  const { id } = await params;
  const { error, message } = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("run_activities")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!r) notFound();

  const svg = routeToSvg(toRoute(r.route), 480, 320);
  const when = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: r.source === "manual" ? undefined : "short",
    timeZone: ctx.timezone,
  }).format(new Date(r.started_at));
  const stats: [string, string][] = [
    ["Distance", formatKm(r.distance_m)],
    ["Moving time", formatDuration(r.moving_seconds)],
    ["Pace", formatPace(paceSecPerKm(r.distance_m, r.moving_seconds))],
  ];
  if (r.elapsed_seconds) stats.push(["Elapsed", formatDuration(r.elapsed_seconds)]);
  if (r.elevation_gain_m !== null) stats.push(["Climb", `${r.elevation_gain_m} m`]);
  if (r.avg_hr) stats.push(["Avg HR", `${r.avg_hr} bpm`]);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/running" className="text-primary">
          ← Running
        </a>
      </p>
      <PageHeader title={r.name} subtitle={`${when} · ${KIND_LABELS[r.kind] ?? r.kind}`} />
      <Flash error={error} message={message} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <Card key={label} title={label}>
            <p className="text-sm">{value}</p>
          </Card>
        ))}
      </div>

      {svg && (
        <Card title="Route" className="mb-6">
          <svg
            viewBox="0 0 480 320"
            className="w-full max-w-xl"
            role="img"
            aria-label="Route outline"
          >
            <path
              d={svg.d}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
              className="text-primary"
            />
            <circle cx={svg.start[0]} cy={svg.start[1]} r="5" className="fill-success" />
            <circle cx={svg.end[0]} cy={svg.end[1]} r="5" className="fill-danger" />
          </svg>
          <p className="mt-1 text-xs text-muted">
            Outline only (no map tiles). Green is the start, red the finish. North is up.
          </p>
        </Card>
      )}

      <Card title="Details" className="mb-6">
        <form action={saveRunEdit} className="grid gap-2 sm:grid-cols-6">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="revision" value={r.revision} />
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={r.name}
            aria-label="Name"
            className={`${inputClass} sm:col-span-4`}
          />
          <select
            name="kind"
            defaultValue={r.kind}
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
            name="effort"
            type="number"
            min="1"
            max="10"
            defaultValue={r.effort ?? ""}
            placeholder="Effort 1-10"
            aria-label="Effort"
            className={`${inputClass} sm:col-span-2`}
          />
          <textarea
            name="notes"
            rows={4}
            maxLength={4000}
            defaultValue={r.notes}
            placeholder="Notes"
            aria-label="Notes"
            className={`${inputClass} sm:col-span-6`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-6`}>
            Save
          </button>
        </form>
      </Card>

      <form action={deleteRun}>
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="revision" value={r.revision} />
        <button type="submit" className={subtleButton}>
          Remove run
        </button>
      </form>
    </div>
  );
}
