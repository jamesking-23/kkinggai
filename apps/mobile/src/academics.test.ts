import { describe, expect, it } from "vitest";
import {
  dueText,
  phoneMoves,
  scoreText,
  sortAssignments,
  statusText,
  summarize,
  type AssignmentRow,
  type CourseRow,
} from "./academics";

const KLA = "Africa/Kampala";
const NOW = new Date("2026-11-23T08:00:00Z"); // 11:00 local
const as = (id: string, status: AssignmentRow["status"], due_at: string | null): AssignmentRow => ({
  id,
  course_id: null,
  title: id,
  due_at,
  status,
  score: null,
  max_score: null,
  revision: 1,
});
const course = (id: string, status: CourseRow["status"]): CourseRow => ({
  id,
  code: null,
  name: id,
  status,
});

describe("academics helpers", () => {
  it("summarises like the website", () => {
    const s = summarize(
      [course("a", "active"), course("b", "completed"), course("c", "active")],
      [
        as("late", "todo", "2026-11-20T09:00:00Z"),
        as("soon", "in_progress", "2026-11-25T09:00:00Z"),
        as("far", "todo", "2026-12-30T09:00:00Z"),
        as("none", "todo", null),
        as("done", "submitted", "2026-11-24T09:00:00Z"),
      ],
      NOW.getTime(),
    );
    expect(s).toEqual({ activeCourses: 2, open: 4, overdue: 1, dueSoon: 1 });
  });
  it("sorts open soonest first, undated last, then submitted, then graded", () => {
    const sorted = sortAssignments([
      as("g", "graded", "2026-11-01T00:00:00Z"),
      as("n", "todo", null),
      as("b", "todo", "2026-12-01T00:00:00Z"),
      as("s", "submitted", "2026-11-10T00:00:00Z"),
      as("a", "in_progress", "2026-11-25T00:00:00Z"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["a", "b", "n", "s", "g"]);
  });
  it("words due dates in the account timezone", () => {
    expect(dueText(null, KLA, NOW)).toBe("No due date");
    expect(dueText("nope", KLA, NOW)).toBe("No due date");
    expect(dueText("2026-11-22T09:00:00Z", KLA, NOW)).toBe("Overdue · Sun 22 Nov 12:00");
    expect(dueText("2026-11-23T11:00:00Z", KLA, NOW)).toBe("Today 14:00");
    expect(dueText("2026-11-24T06:00:00Z", KLA, NOW)).toBe("Tomorrow 09:00");
    expect(dueText("2026-11-22T21:30:00Z", KLA, NOW, false)).toBe("Today 00:30");
  });
  it("offers phone moves except grading, and formats scores and labels", () => {
    expect(phoneMoves("todo")).toEqual(["in_progress", "submitted"]);
    expect(phoneMoves("submitted")).toEqual(["todo", "in_progress"]);
    expect(scoreText({ score: 18, max_score: 20 })).toBe("18 / 20");
    expect(scoreText({ score: 7, max_score: null })).toBe("7");
    expect(scoreText({ score: null, max_score: 20 })).toBe("");
    expect(statusText("in_progress")).toBe("In progress");
  });
});
