// Running helpers, mirroring apps/web/lib/running.ts and the manual-run rules in packages/schemas. Pure.
// Run kinds are repeated from the shared schemas; keep them in sync.

export const RUN_KINDS = [
  "easy",
  "long",
  "tempo",
  "intervals",
  "race",
  "trail",
  "treadmill",
  "other",
] as const;
export type RunKind = (typeof RUN_KINDS)[number];

export const KIND_LABELS: Record<RunKind, string> = {
  easy: "Easy",
  long: "Long run",
  tempo: "Tempo",
  intervals: "Intervals",
  race: "Race",
  trail: "Trail",
  treadmill: "Treadmill",
  other: "Other",
};

export type RunRow = {
  id: string;
  name: string;
  kind: RunKind;
  started_at: string;
  distance_m: number;
  moving_seconds: number;
};

export function formatPace(distanceM: number, seconds: number): string {
  const sec = seconds / (distanceM / 1000);
  if (!Number.isFinite(sec) || sec <= 0) return "–";
  let m = Math.floor(sec / 60);
  let s = Math.round(sec % 60);
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

/** Monday of the week containing a yyyy-mm-dd date. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

export type Totals = { runs: number; distanceM: number; movingSeconds: number };
const zero = (): Totals => ({ runs: 0, distanceM: 0, movingSeconds: 0 });

/** Totals for this week, this month, all time and the last `weeksBack` weeks. `dateOf` gives a run's local yyyy-mm-dd. */
export function summarise(
  rows: readonly RunRow[],
  today: string,
  dateOf: (iso: string) => string,
  weeksBack = 8,
) {
  const thisWeek = weekStart(today);
  const month = today.slice(0, 7);
  const week = zero();
  const mon = zero();
  const all = zero();
  const byWeek = new Map<string, Totals>();
  const add = (t: Totals, r: RunRow) => {
    t.runs++;
    t.distanceM += r.distance_m;
    t.movingSeconds += r.moving_seconds;
  };
  for (const r of rows) {
    const date = dateOf(r.started_at);
    add(all, r);
    if (date.slice(0, 7) === month) add(mon, r);
    const ws = weekStart(date);
    if (ws === thisWeek) add(week, r);
    add(byWeek.get(ws) ?? byWeek.set(ws, zero()).get(ws)!, r);
  }
  const weeks: (Totals & { weekStart: string })[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(`${thisWeek}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    const key = d.toISOString().slice(0, 10);
    weeks.push({ weekStart: key, ...(byWeek.get(key) ?? zero()) });
  }
  return { week, month: mon, all, weeks };
}

/** Distance in metres from text such as "5", "5.25" or "5,25" km. Returns null unless 0.01–1000 km. */
export function parseDistanceM(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const km = Number(t);
  if (km < 0.01 || km > 1000) return null;
  return Math.round(km * 1000);
}

/** Seconds from hours, minutes and seconds fields (blank means 0). Null if a field is invalid or the total is 0. */
export function parseDurationSeconds(h: string, m: string, s: string): number | null {
  const part = (v: string, max: number) => {
    const t = v.trim();
    if (t === "") return 0;
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    return n > max ? null : n;
  };
  const hh = part(h, 99);
  const mm = part(m, 59);
  const ss = part(s, 59);
  if (hh === null || mm === null || ss === null) return null;
  const total = hh * 3600 + mm * 60 + ss;
  return total > 0 ? total : null;
}

/** Noon UTC keeps the entered calendar day in every time zone from UTC-12 to UTC+11, like the website. */
export const startedAt = (date: string) => `${date}T12:00:00Z`;

export function cleanName(v: string): string {
  return v.trim().slice(0, 200);
}
