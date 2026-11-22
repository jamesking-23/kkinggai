import { describe, expect, it } from "vitest";
import {
  deadlineLabel,
  goalProgress,
  parseValue,
  sortGoals,
  valueText,
  type GoalRow,
} from "./goals";

const g = (over: Partial<GoalRow>): GoalRow => ({
  id: "x",
  title: "t",
  target_value: null,
  current_value: 0,
  unit: null,
  deadline: null,
  status: "active",
  revision: 1,
  ...over,
});

describe("goal helpers", () => {
  it("computes progress and clamps it", () => {
    expect(goalProgress(25, 100)).toBe(25);
    expect(goalProgress(150, 100)).toBe(100);
    expect(goalProgress(-5, 100)).toBe(0);
    expect(goalProgress(5, null)).toBeNull();
    expect(goalProgress(5, 0)).toBeNull();
  });
  it("parses typed values", () => {
    expect(parseValue("12")).toBe(12);
    expect(parseValue(" 3,5 ")).toBe(3.5);
    for (const bad of ["", "abc", "-1", "1e3", "1.", ".5", "12 km", "9".repeat(20)])
      expect(parseValue(bad)).toBeNull();
  });
  it("labels deadlines", () => {
    const today = "2026-11-23";
    expect(deadlineLabel(null, today)).toBe("");
    expect(deadlineLabel("2026-11-22", today)).toBe("Overdue");
    expect(deadlineLabel("2026-11-23", today)).toBe("Due today");
    expect(deadlineLabel("2026-11-24", today)).toBe("Due in 1 day");
    expect(deadlineLabel("2026-11-30T00:00:00Z", today)).toBe("Due in 7 days");
    expect(deadlineLabel("2027-01-05", today)).toBe("Due 2027-01-05");
    expect(deadlineLabel("garbage", today)).toBe("");
  });
  it("sorts active first by deadline, then achieved, then abandoned", () => {
    const sorted = sortGoals([
      g({ id: "ab", status: "abandoned" }),
      g({ id: "late", deadline: "2027-02-01" }),
      g({ id: "none" }),
      g({ id: "done", status: "achieved" }),
      g({ id: "soon", deadline: "2026-12-01" }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["soon", "late", "none", "done", "ab"]);
  });
  it("describes values", () => {
    expect(valueText({ current_value: 12, target_value: 50, unit: "km" })).toBe("12 of 50 km");
    expect(valueText({ current_value: 3, target_value: null, unit: null })).toBe("3");
  });
});
