import { addDays } from "./time";

/** Repeat choices offered for a task, and the iCalendar-style rule stored for each. */
export const RECURRENCES = [
  { id: "daily", label: "Every day", rule: "FREQ=DAILY" },
  { id: "weekdays", label: "Every weekday (Mon-Fri)", rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { id: "weekly", label: "Every week", rule: "FREQ=WEEKLY" },
  { id: "monthly", label: "Every month", rule: "FREQ=MONTHLY" },
  { id: "yearly", label: "Every year", rule: "FREQ=YEARLY" },
] as const;

export type RecurrenceId = (typeof RECURRENCES)[number]["id"];

export const ruleFor = (id: string): string | null =>
  RECURRENCES.find((r) => r.id === id)?.rule ?? null;

export const labelForRule = (rule: string | null): string | null =>
  RECURRENCES.find((r) => r.rule === rule)?.label ?? null;

export const idForRule = (rule: string | null): RecurrenceId | "" =>
  RECURRENCES.find((r) => r.rule === rule)?.id ?? "";

const parts = (d: string) => d.split("-").map(Number) as [number, number, number];
const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 0 = Sunday ... 6 = Saturday, for a "YYYY-MM-DD" date. */
function weekday(d: string): number {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

/** The next occurrence strictly after `date` ("YYYY-MM-DD"). Months and years keep the day, clamped to the month's end. */
export function nextOccurrence(rule: string, date: string): string | null {
  const [y, m, d] = parts(date);
  switch (rule) {
    case "FREQ=DAILY":
      return addDays(date, 1);
    case "FREQ=WEEKLY":
      return addDays(date, 7);
    case "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR": {
      let next = addDays(date, 1);
      while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, 1);
      return next;
    }
    case "FREQ=MONTHLY": {
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      return `${ny}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`;
    }
    case "FREQ=YEARLY":
      return `${y + 1}-${pad(m)}-${pad(Math.min(d, daysIn(y + 1, m)))}`;
    default:
      return null;
  }
}

/**
 * Due date of the next copy of a recurring task: the next occurrence after the old due date, skipping any that are already
 * in the past (a task finished late does not spawn a pile of overdue copies). With no due date the cycle starts today.
 * Monthly rules lose a long day for good after a short month (31 Jan, 28 Feb, 28 Mar...), because the original day is not stored.
 */
export function nextDueDate(rule: string, dueDate: string | null, today: string): string | null {
  let next = nextOccurrence(rule, dueDate ?? today);
  if (next === null) return null;
  for (let i = 0; i < 1000 && next < today; i++) {
    const n = nextOccurrence(rule, next);
    if (n === null) return null;
    next = n;
  }
  return next < today ? null : next;
}
