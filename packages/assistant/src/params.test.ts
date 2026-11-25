import { describe, expect, it } from "vitest";
import {
  addDays,
  afterLeadIn,
  extractDate,
  extractDistanceM,
  extractDurationSeconds,
  extractQuery,
} from "./params";

describe("params", () => {
  it("finds dates", () => {
    expect(extractDate("buy milk tomorrow", "2026-11-25")).toEqual({
      date: "2026-11-26",
      rest: "buy milk",
    });
    expect(extractDate("pay rent by friday", "2026-11-25")).toEqual({
      date: "2026-11-27",
      rest: "pay rent",
    });
    expect(extractDate("call mum 2026-12-01", "2026-11-25")).toEqual({
      date: "2026-12-01",
      rest: "call mum",
    });
    expect(extractDate("call mum 2026-02-30", "2026-11-25").date).toBeNull();
    expect(extractDate("nothing here", "2026-11-25").date).toBeNull();
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("finds distances", () => {
    expect(extractDistanceM("ran 5km")).toBe(5000);
    expect(extractDistanceM("ran 5,5 k today")).toBe(5500);
    expect(extractDistanceM("3 miles")).toBe(4828);
    expect(extractDistanceM("800 m")).toBe(800);
    expect(extractDistanceM("5 m")).toBeNull();
    expect(extractDistanceM("no distance")).toBeNull();
  });
  it("finds durations", () => {
    expect(extractDurationSeconds("in 30 minutes")).toBe(1800);
    expect(extractDurationSeconds("1h 5m")).toBe(3900);
    expect(extractDurationSeconds("45:30")).toBe(2730);
    expect(extractDurationSeconds("1:05:30")).toBe(3930);
    expect(extractDurationSeconds("none")).toBeNull();
  });
  it("finds lead-ins and queries", () => {
    expect(afterLeadIn("Add task: buy milk!", [/\badd task\b/i])).toBe("buy milk");
    expect(afterLeadIn("hello", [/\badd task\b/i])).toBeNull();
    expect(extractQuery('search for "chess opening"')).toBe("chess opening");
    expect(extractQuery("search for invoice")).toBe("invoice");
    expect(extractQuery("search")).toBeNull();
  });
});
