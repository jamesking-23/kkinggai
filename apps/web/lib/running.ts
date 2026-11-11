/** Pure helpers for running: formatting, route drawing and training statistics. Safe to import from client components. */

export const KIND_LABELS: Record<string, string> = {
  easy: "Easy",
  long: "Long run",
  tempo: "Tempo",
  intervals: "Intervals",
  race: "Race",
  trail: "Trail",
  treadmill: "Treadmill",
  other: "Other",
};

export function paceSecPerKm(distanceM: number, seconds: number): number {
  return seconds / (distanceM / 1000);
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return "–";
  let m = Math.floor(secPerKm / 60);
  let s = Math.round(secPerKm % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export const formatKm = (m: number) => `${(m / 1000).toFixed(m >= 100_000 ? 0 : 2)} km`;

/** Draws a route as an SVG path (equirectangular, no map tiles). Returns null for fewer than two points. */
export function routeToSvg(
  route: [number, number][],
  width: number,
  height: number,
  pad = 8,
): { d: string; start: [number, number]; end: [number, number] } | null {
  if (route.length < 2) return null;
  const midLat = route.reduce((a, p) => a + p[0], 0) / route.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k);
  const ys = route.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const pts = route.map((_, i): [number, number] => [
    Math.round((offX + (xs[i]! - minX) * scale) * 10) / 10,
    Math.round((height - (offY + (ys[i]! - minY) * scale)) * 10) / 10,
  ]);
  return {
    d: pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" "),
    start: pts[0]!,
    end: pts.at(-1)!,
  };
}

export type RunRow = {
  started_at: string;
  distance_m: number;
  moving_seconds: number;
};

/** yyyy-mm-dd of an instant in a time zone. */
export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Monday of the week containing a yyyy-mm-dd date. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export type Totals = { runs: number; distanceM: number; movingSeconds: number };
const zero = (): Totals => ({ runs: 0, distanceM: 0, movingSeconds: 0 });
const add = (t: Totals, r: RunRow) => {
  t.runs++;
  t.distanceM += r.distance_m;
  t.movingSeconds += r.moving_seconds;
};

export const BEST_THRESHOLDS_KM = [5, 10, 21.0975, 42.195] as const;

export type RunSummary = {
  week: Totals;
  month: Totals;
  all: Totals;
  weeks: (Totals & { weekStart: string })[];
  /** Fastest average pace over single runs of at least the given distance. Not a split-based personal best. */
  bests: { km: number; secPerKm: number }[];
};

export function summariseRuns(
  rows: RunRow[],
  now: Date,
  timeZone: string,
  weeksBack = 8,
): RunSummary {
  const today = localDate(now.toISOString(), timeZone);
  const thisWeek = weekStart(today);
  const month = today.slice(0, 7);
  const week = zero();
  const mon = zero();
  const all = zero();
  const byWeek = new Map<string, Totals>();
  const bestPace = new Map<number, number>();

  for (const r of rows) {
    const date = localDate(r.started_at, timeZone);
    add(all, r);
    if (date.slice(0, 7) === month) add(mon, r);
    const ws = weekStart(date);
    if (ws === thisWeek) add(week, r);
    add(byWeek.get(ws) ?? byWeek.set(ws, zero()).get(ws)!, r);
    const pace = paceSecPerKm(r.distance_m, r.moving_seconds);
    for (const km of BEST_THRESHOLDS_KM) {
      if (r.distance_m >= km * 1000 && pace < (bestPace.get(km) ?? Infinity))
        bestPace.set(km, pace);
    }
  }

  const weeks: (Totals & { weekStart: string })[] = [];
  const cur = new Date(`${thisWeek}T00:00:00Z`);
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(cur);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    const key = d.toISOString().slice(0, 10);
    weeks.push({ weekStart: key, ...(byWeek.get(key) ?? zero()) });
  }

  return {
    week,
    month: mon,
    all,
    weeks,
    bests: BEST_THRESHOLDS_KM.filter((km) => bestPace.has(km)).map((km) => ({
      km,
      secPerKm: bestPace.get(km)!,
    })),
  };
}
