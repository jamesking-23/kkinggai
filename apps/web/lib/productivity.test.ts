import { describe, expect, it } from "vitest";
import { dailyStreak, goalProgress, isOverdue } from "./productivity";

describe("goalProgress", () => {
  it("computes and clamps percent", () => {
    expect(goalProgress(25, 100)).toBe(25);
    expect(goalProgress(150, 100)).toBe(100);
    expect(goalProgress(0, 10)).toBe(0);
  });

  it("returns null without a usable target", () => {
    expect(goalProgress(5, null)).toBeNull();
    expect(goalProgress(5, 0)).toBeNull();
  });
});

describe("dailyStreak", () => {
  it("counts consecutive days including today", () => {
    expect(dailyStreak(["2026-11-07", "2026-11-06", "2026-11-05"], "2026-11-07")).toBe(3);
  });

  it("keeps the streak alive when only yesterday is logged", () => {
    expect(dailyStreak(["2026-11-06", "2026-11-05"], "2026-11-07")).toBe(2);
  });

  it("breaks on a gap and handles no logs", () => {
    expect(dailyStreak(["2026-11-07", "2026-11-05"], "2026-11-07")).toBe(1);
    expect(dailyStreak(["2026-11-04"], "2026-11-07")).toBe(0);
    expect(dailyStreak([], "2026-11-07")).toBe(0);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  it("flags open tasks past due only", () => {
    expect(isOverdue({ status: "todo", due_at: "2026-11-07T08:00:00Z" }, now)).toBe(true);
    expect(isOverdue({ status: "done", due_at: "2026-11-07T08:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ status: "todo", due_at: "2026-11-08T08:00:00Z" }, now)).toBe(false);
    expect(isOverdue({ status: "todo", due_at: null }, now)).toBe(false);
  });
});
