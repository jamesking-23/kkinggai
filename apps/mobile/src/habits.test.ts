import { describe, expect, it } from "vitest";
import { addDays, cleanHabitName, dailyStreak, viewHabit, weekCount, weekStart } from "./habits";

const T = "2026-11-23"; // a Monday

describe("habit helpers", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("bad", 1)).toBe("bad");
  });
  it("counts the streak, keeping it alive until today is missed", () => {
    expect(dailyStreak([], T)).toBe(0);
    expect(dailyStreak(["2026-11-23", "2026-11-22", "2026-11-21"], T)).toBe(3);
    expect(dailyStreak(["2026-11-22", "2026-11-21"], T)).toBe(2); // today not yet logged
    expect(dailyStreak(["2026-11-21"], T)).toBe(0); // missed yesterday
    expect(dailyStreak(["2026-11-23", "2026-11-21"], T)).toBe(1); // gap
  });
  it("finds the week start (Monday)", () => {
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(weekStart("2026-11-29")).toBe("2026-11-23"); // Sunday
    expect(weekStart("2026-11-26")).toBe("2026-11-23");
  });
  it("counts logs this week only, ignoring duplicates and future dates", () => {
    expect(weekCount(["2026-11-22", "2026-11-23"], T)).toBe(1);
    expect(weekCount(["2026-11-23", "2026-11-23", "2026-11-24"], T)).toBe(1);
    expect(weekCount([], T)).toBe(0);
    expect(weekCount(["2026-11-23", "2026-11-25"], "2026-11-26")).toBe(2);
  });
  it("builds the row view", () => {
    const base = {
      id: "h",
      workspace_id: "w",
      name: "Run",
      cadence: "daily" as const,
      target_per_period: 1,
    };
    const v = viewHabit(base, ["2026-11-23", "2026-11-22"], T);
    expect(v).toMatchObject({ doneToday: true, streak: 2, week: 1, progress: "1 of 7 this week" });
    const w = viewHabit({ ...base, cadence: "weekly", target_per_period: 3 }, ["2026-11-23"], T);
    expect(w).toMatchObject({ streak: 0, progress: "1 of 3 this week" });
  });
  it("cleans names", () => {
    expect(cleanHabitName("  Read   daily ")).toBe("Read daily");
    expect(cleanHabitName("   ")).toBeNull();
    expect(cleanHabitName("x".repeat(300))).toHaveLength(200);
  });
});
