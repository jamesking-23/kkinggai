// Personal helpers (journal and important dates), mirroring apps/web/lib/personal.ts and the rules in packages/schemas. Pure.
// Kinds and moods are repeated from the website; keep them in sync.

export const DATE_KINDS = ["birthday", "anniversary", "deadline", "other"] as const;
export type DateKind = (typeof DATE_KINDS)[number];

export const MOODS = ["", "Very low", "Low", "Okay", "Good", "Great"];

export type DateRow = {
  id: string;
  title: string;
  kind: DateKind;
  month: number;
  day: number;
  year: number | null;
  notes: string;
  revision: number;
};
export type Upcoming = { date: string; daysAway: number; turning: number | null };

const MS_DAY = 86_400_000;
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/** The next time a yearly date falls, counting `today` (YYYY-MM-DD) as day 0. 29 February is observed on 28 February in non-leap years. */
export function nextOccurrence(
  row: Pick<DateRow, "month" | "day" | "year">,
  today: string,
): Upcoming {
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const todayMs = utc(ty, tm, td);
  const on = (y: number) => {
    const feb29 = row.month === 2 && row.day === 29 && !isLeap(y);
    return { y, m: row.month, d: feb29 ? 28 : row.day };
  };
  let o = on(ty);
  if (utc(o.y, o.m, o.d) < todayMs) o = on(ty + 1);
  return {
    date: `${o.y}-${pad(o.m)}-${pad(o.d)}`,
    daysAway: Math.round((utc(o.y, o.m, o.d) - todayMs) / MS_DAY),
    turning: row.year === null ? null : o.y - row.year,
  };
}

/** Rows ordered by how soon they next occur. */
export function upcoming<T extends Pick<DateRow, "month" | "day" | "year">>(
  rows: readonly T[],
  today: string,
): (T & Upcoming)[] {
  return rows
    .map((r) => ({ ...r, ...nextOccurrence(r, today) }))
    .sort((a, b) => a.daysAway - b.daysAway);
}

export function daysAwayText(d: number): string {
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

/** Validated important date fields, or an error message. Same rules as the website. */
export function checkDate(
  title: string,
  month: string,
  day: string,
  year: string,
  notes: string,
): { title: string; month: number; day: number; year: number | null; notes: string } | string {
  const t = title.trim();
  if (!t) return "Enter a title.";
  if (t.length > 160) return "The title is too long (160 characters at most).";
  if (!/^\d{1,2}$/.test(month.trim()) || +month < 1 || +month > 12) return "Month must be 1 to 12.";
  if (!/^\d{1,2}$/.test(day.trim()) || +day < 1 || +day > 31) return "Day must be 1 to 31.";
  let y: number | null = null;
  if (year.trim() !== "") {
    if (!/^\d{4}$/.test(year.trim()) || +year < 1900 || +year > 2200)
      return "Year must be 1900 to 2200, or blank.";
    y = Number(year);
  }
  const m = Number(month);
  const d = Number(day);
  const probe = new Date(Date.UTC(y ?? 2000, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return "That date does not exist.";
  if (notes.trim().length > 1000) return "The notes are too long (1000 characters at most).";
  return { title: t, month: m, day: d, year: y, notes: notes.trim() };
}

/** Journal body and tags, or an error message. Tags are comma separated, lower-cased, at most 20 of 40 characters. */
export function checkJournal(
  body: string,
  tags: string,
): { body: string; tags: string[] } | string {
  const b = body.trim();
  if (!b) return "Write something first.";
  if (b.length > 20000) return "Use at most 20,000 characters.";
  const list = tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 20) return "Use at most 20 tags.";
  if (list.some((t) => t.length > 40)) return "Each tag can be at most 40 characters.";
  return { body: b, tags: list };
}

export type JournalRow = {
  id: string;
  entry_date: string;
  mood: number | null;
  body: string;
  tags: string[];
};

export const moodText = (m: number | null) => (m && MOODS[m] ? MOODS[m] : "");
