import { addDays, localDate } from "./time";

export const PLAN_BUCKETS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "Next 7 days" },
  { id: "later", label: "Later" },
  { id: "undated", label: "No due date" },
] as const;

export type PlanBucketId = (typeof PLAN_BUCKETS)[number]["id"];

export type PlannableTask = { status: string; due_at: string | null };

/**
 * Which planning bucket an open task belongs to, by its due date in the user's time zone.
 * Done and cancelled tasks have no bucket. "Next 7 days" starts the day after tomorrow.
 */
export function bucketFor(task: PlannableTask, today: string, tz: string): PlanBucketId | null {
  if (task.status !== "todo" && task.status !== "in_progress") return null;
  if (!task.due_at) return "undated";
  const due = localDate(task.due_at, tz);
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due === addDays(today, 1)) return "tomorrow";
  if (due <= addDays(today, 7)) return "week";
  return "later";
}

/** Group open tasks into the planning buckets, keeping the input order inside each bucket. */
export function planTasks<T extends PlannableTask>(
  tasks: readonly T[],
  today: string,
  tz: string,
): Record<PlanBucketId, T[]> {
  const out: Record<PlanBucketId, T[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
    undated: [],
  };
  for (const t of tasks) {
    const b = bucketFor(t, today, tz);
    if (b) out[b].push(t);
  }
  return out;
}
