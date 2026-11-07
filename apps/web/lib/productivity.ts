import { addDays } from "./time";

/** Percent complete (0–100), or null when the goal has no numeric target. */
export function goalProgress(current: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

/**
 * Consecutive-day streak ending today. If today is not logged yet the streak is still alive when
 * yesterday was, so a habit does not show 0 on the morning before it is done.
 */
export function dailyStreak(loggedDates: readonly string[], today: string): number {
  const set = new Set(loggedDates);
  let day = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Normal",
  4: "Low",
};

export type TaskLike = { status: string; due_at: string | null };

export function isOverdue(task: TaskLike, now: Date): boolean {
  return (
    (task.status === "todo" || task.status === "in_progress") &&
    task.due_at !== null &&
    new Date(task.due_at).getTime() < now.getTime()
  );
}
