import type { TrackPoint } from "./gpx";
import { localDate, weekStart } from "./running";

/** Width of one heart-rate bucket in bpm. */
export const BUCKET_BPM = 5;
/** A gap between two samples longer than this is treated as a pause and not counted. */
const MAX_GAP_SECONDS = 30;

export type HrBuckets = Record<string, number>;

/**
 * Seconds spent at each 5 bpm step ("140" means 140-144 bpm), from a track's heart-rate samples.
 * Each sample counts for the time since the previous one. Returns null when there is too little heart-rate data
 * to say anything (under 10 samples or under a minute in total).
 */
export function hrHistogram(points: readonly TrackPoint[]): HrBuckets | null {
  const out: HrBuckets = {};
  let samples = 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const prev = points[i - 1]!;
    if (typeof p.hr !== "number" || p.t === null || prev.t === null) continue;
    samples++;
    const dt = Math.min(MAX_GAP_SECONDS, (p.t - prev.t) / 1000);
    if (!(dt > 0)) continue;
    const key = String(Math.floor(p.hr / BUCKET_BPM) * BUCKET_BPM);
    out[key] = Math.round(((out[key] ?? 0) + dt) * 10) / 10;
    total += dt;
  }
  return samples >= 10 && total >= 60 ? out : null;
}

export type Zone = { id: string; label: string; from: number; to: number };

/** Five zones as a share of maximum heart rate. Anything under 50 % is "below zone 1". */
export const ZONES: readonly Zone[] = [
  { id: "z1", label: "Zone 1 · Very easy", from: 0.5, to: 0.6 },
  { id: "z2", label: "Zone 2 · Easy", from: 0.6, to: 0.7 },
  { id: "z3", label: "Zone 3 · Steady", from: 0.7, to: 0.8 },
  { id: "z4", label: "Zone 4 · Hard", from: 0.8, to: 0.9 },
  { id: "z5", label: "Zone 5 · Maximal", from: 0.9, to: 10 },
];

export type ZoneTime = { id: string; label: string; seconds: number; share: number; range: string };

/** Reads stored buckets back, ignoring anything that is not a number of seconds. */
export function parseBuckets(raw: unknown): HrBuckets | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: HrBuckets = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{2,3}$/.test(k) && typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Time in each zone for a given maximum heart rate. A bucket is placed by its middle (so 140-144 counts as 142.5),
 * which makes the result accurate to about one bucket. Returns the seconds below zone 1 separately.
 */
export function zoneBreakdown(
  buckets: HrBuckets,
  maxHr: number,
): { zones: ZoneTime[]; below: number; total: number } {
  const seconds = new Map<string, number>(ZONES.map((z) => [z.id, 0]));
  let below = 0;
  let total = 0;
  for (const [k, s] of Object.entries(buckets)) {
    const mid = Number(k) + BUCKET_BPM / 2;
    const share = mid / maxHr;
    total += s;
    const zone = [...ZONES].reverse().find((z) => share >= z.from);
    if (!zone) below += s;
    else seconds.set(zone.id, (seconds.get(zone.id) ?? 0) + s);
  }
  return {
    below,
    total,
    zones: ZONES.map((z) => ({
      id: z.id,
      label: z.label,
      seconds: seconds.get(z.id) ?? 0,
      share: total > 0 ? (seconds.get(z.id) ?? 0) / total : 0,
      range:
        z.to > 1
          ? `${Math.round(z.from * maxHr)}+ bpm`
          : `${Math.round(z.from * maxHr)}-${Math.round(z.to * maxHr) - 1} bpm`,
    })),
  };
}

export type WeekZones = { weekStart: string; seconds: number[]; below: number; total: number };

/**
 * Time in each zone per week (Monday start, in the user's time zone) for the last `weeks` weeks, oldest first.
 * Runs without heart-rate data are ignored; weeks with none are all zeros.
 */
export function weeklyZones(
  runs: readonly { started_at: string; hr_buckets: unknown }[],
  maxHr: number,
  now: Date,
  timeZone: string,
  weeks = 8,
): WeekZones[] {
  const cur = new Date(`${weekStart(localDate(now.toISOString(), timeZone))}T00:00:00Z`);
  const out = new Map<string, WeekZones>();
  const order: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(cur);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    const key = d.toISOString().slice(0, 10);
    order.push(key);
    out.set(key, { weekStart: key, seconds: ZONES.map(() => 0), below: 0, total: 0 });
  }
  for (const r of runs) {
    const buckets = parseBuckets(r.hr_buckets);
    const w = out.get(weekStart(localDate(r.started_at, timeZone)));
    if (!buckets || !w) continue;
    const z = zoneBreakdown(buckets, maxHr);
    z.zones.forEach((zone, i) => (w.seconds[i] = w.seconds[i]! + zone.seconds));
    w.below += z.below;
    w.total += z.total;
  }
  return order.map((k) => out.get(k)!);
}
