// Habit helpers, mirroring the website's rules (apps/web/lib/productivity.ts). Dates are YYYY-MM-DD in the account's timezone.

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, n: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return date;
  return new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}

/** Consecutive-day streak ending today; still alive when only yesterday is logged, so it does not show 0 before today's check-in. */
export function dailyStreak(logged: readonly string[], today: string): number {
  const set = new Set(logged);
  let day = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** Monday of the week containing the date. */
export function weekStart(today: string): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, -((dow + 6) % 7));
}

/** Logs from this week's Monday up to and including today. */
export function weekCount(logged: readonly string[], today: string): number {
  const start = weekStart(today);
  return new Set(logged).size === 0
    ? 0
    : [...new Set(logged)].filter((d) => d >= start && d <= today).length;
}

export type HabitRow = {
  id: string;
  workspace_id: string;
  name: string;
  cadence: "daily" | "weekly";
  target_per_period: number;
};

export type HabitView = HabitRow & {
  doneToday: boolean;
  streak: number;
  week: number;
  progress: string;
};

/** Everything the list needs for one habit. Daily habits show the week against 7; weekly ones against their target. */
export function viewHabit(h: HabitRow, logged: readonly string[], today: string): HabitView {
  const week = weekCount(logged, today);
  return {
    ...h,
    doneToday: logged.includes(today),
    streak: h.cadence === "daily" ? dailyStreak(logged, today) : 0,
    week,
    progress: `${week} of ${h.cadence === "weekly" ? h.target_per_period : 7} this week`,
  };
}

/** Trimmed habit name, or null when empty. Capped at 200 characters like the database. */
export function cleanHabitName(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, 200) : null;
}
