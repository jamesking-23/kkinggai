// Academics helpers, mirroring the website's counting rules (apps/web/app/(app)/academics/page.tsx). Pure.
// Statuses are repeated from packages/schemas (the phone app does not depend on it); keep them in sync.
import { dayLabel, localDate, localTime } from "./agenda";

export const ASSIGNMENT_STATUSES = ["todo", "in_progress", "submitted", "graded"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export type CourseRow = {
  id: string;
  code: string | null;
  name: string;
  status: "active" | "completed" | "dropped";
};
export type AssignmentRow = {
  id: string;
  course_id: string | null;
  title: string;
  due_at: string | null;
  status: AssignmentStatus;
  score: number | null;
  max_score: number | null;
  revision: number;
};

export const isOpen = (a: Pick<AssignmentRow, "status">) =>
  a.status === "todo" || a.status === "in_progress";

export function statusText(s: AssignmentStatus): string {
  return { todo: "To do", in_progress: "In progress", submitted: "Submitted", graded: "Graded" }[s];
}

/** Counts shown in the tiles: active courses, open assignments, due within 7 days (not yet overdue), overdue. */
export function summarize(
  courses: readonly CourseRow[],
  assignments: readonly AssignmentRow[],
  now: number,
) {
  const open = assignments.filter(isOpen);
  const t = (a: AssignmentRow) => (a.due_at ? Date.parse(a.due_at) : NaN);
  return {
    activeCourses: courses.filter((c) => c.status === "active").length,
    open: open.length,
    overdue: open.filter((a) => t(a) < now).length,
    dueSoon: open.filter((a) => t(a) >= now && t(a) < now + 7 * 86_400_000).length,
  };
}

/** Open work first (soonest due first, undated last), then submitted, then graded. */
export function sortAssignments(list: readonly AssignmentRow[]): AssignmentRow[] {
  const rank = { todo: 0, in_progress: 0, submitted: 1, graded: 2 } as const;
  const key = (a: AssignmentRow) =>
    a.due_at && Number.isFinite(Date.parse(a.due_at)) ? Date.parse(a.due_at) : Infinity;
  return [...list].sort((a, b) => rank[a.status] - rank[b.status] || key(a) - key(b));
}

/** "Overdue · Mon 23 Nov", "Today 14:00", "Tomorrow 09:00", "Wed 25 Nov 09:00", or "No due date". Local to the timezone. */
export function dueText(due: string | null, tz: string, now: Date, overdueCheck = true): string {
  if (!due || !Number.isFinite(Date.parse(due))) return "No due date";
  const today = localDate(now.toISOString(), tz);
  const day = localDate(due, tz);
  const time = localTime(due, tz);
  if (overdueCheck && Date.parse(due) < now.getTime())
    return `Overdue · ${dayLabel(day, today)} ${time}`;
  return `${dayLabel(day, today)} ${time}`;
}

/** Statuses an open or submitted assignment can move to from the phone. Grading needs a score, so it stays on the website. */
export function phoneMoves(s: AssignmentStatus): AssignmentStatus[] {
  return (["todo", "in_progress", "submitted"] as const).filter((x) => x !== s);
}

/** "18 / 20" or "" when ungraded. */
export function scoreText(a: Pick<AssignmentRow, "score" | "max_score">): string {
  if (a.score === null) return "";
  return a.max_score ? `${a.score} / ${a.max_score}` : String(a.score);
}
