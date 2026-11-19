import { describe, expect, it } from "vitest";
import { bucketFor, planTasks } from "./planning";

const TZ = "Africa/Kampala"; // UTC+3
const todo = (due_at: string | null, status = "todo") => ({ status, due_at });

describe("bucketFor", () => {
  const today = "2026-11-19";
  it("sorts by local due date", () => {
    expect(bucketFor(todo("2026-11-18T20:59:00Z"), today, TZ)).toBe("overdue"); // 23:59 on the 18th
    expect(bucketFor(todo("2026-11-19T20:59:00Z"), today, TZ)).toBe("today");
    expect(bucketFor(todo("2026-11-20T20:59:00Z"), today, TZ)).toBe("tomorrow");
    expect(bucketFor(todo("2026-11-21T20:59:00Z"), today, TZ)).toBe("week");
    expect(bucketFor(todo("2026-11-26T20:59:00Z"), today, TZ)).toBe("week"); // today + 7
    expect(bucketFor(todo("2026-11-27T20:59:00Z"), today, TZ)).toBe("later");
  });
  it("uses the user's time zone, not UTC, for the day boundary", () => {
    // 22:30 UTC on the 19th is 01:30 on the 20th in Kampala.
    expect(bucketFor(todo("2026-11-19T22:30:00Z"), today, TZ)).toBe("tomorrow");
    expect(bucketFor(todo("2026-11-19T22:30:00Z"), today, "UTC")).toBe("today");
  });
  it("puts open tasks without a date in undated", () => {
    expect(bucketFor(todo(null), today, TZ)).toBe("undated");
    expect(bucketFor(todo(null, "in_progress"), today, TZ)).toBe("undated");
  });
  it("ignores finished tasks", () => {
    expect(bucketFor(todo("2026-11-18T20:59:00Z", "done"), today, TZ)).toBeNull();
    expect(bucketFor(todo(null, "cancelled"), today, TZ)).toBeNull();
  });
});

describe("planTasks", () => {
  it("groups, keeps order and drops finished tasks", () => {
    const a = { ...todo("2026-11-19T20:59:00Z"), id: "a" };
    const b = { ...todo("2026-11-19T10:00:00Z"), id: "b" };
    const c = { ...todo(null), id: "c" };
    const d = { ...todo("2026-11-19T20:59:00Z", "done"), id: "d" };
    const plan = planTasks([a, b, c, d], "2026-11-19", TZ);
    expect(plan.today.map((t) => t.id)).toEqual(["a", "b"]);
    expect(plan.undated.map((t) => t.id)).toEqual(["c"]);
    expect(plan.overdue).toEqual([]);
  });
});
