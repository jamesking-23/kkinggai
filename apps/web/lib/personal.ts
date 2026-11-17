export type DateRow = { month: number; day: number; year: number | null };
export type Upcoming = { date: string; daysAway: number; turning: number | null };

const MS_DAY = 86_400_000;
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/**
 * The next time a yearly date falls, counting `today` (YYYY-MM-DD) as day 0.
 * A 29 February date is observed on 28 February in years that are not leap years.
 * `turning` is the age or anniversary number when a year was recorded.
 */
export function nextOccurrence(row: DateRow, today: string): Upcoming {
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

/** Rows ordered by how soon they next occur; `withinDays` drops anything later. */
export function upcoming<T extends DateRow>(
  rows: T[],
  today: string,
  withinDays = 366,
): (T & Upcoming)[] {
  return rows
    .map((r) => ({ ...r, ...nextOccurrence(r, today) }))
    .filter((r) => r.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

export const MOODS = ["", "Very low", "Low", "Okay", "Good", "Great"];
