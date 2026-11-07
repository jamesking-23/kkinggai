import { describe, expect, it } from "vitest";
import { addDays, isValidMonth, localDate, monthGrid, shiftMonth, zonedTimeToUtc } from "./time";

describe("zonedTimeToUtc", () => {
  it("converts Kampala (UTC+3, no DST)", () => {
    expect(zonedTimeToUtc("2026-11-07T10:00", "Africa/Kampala").toISOString()).toBe(
      "2026-11-07T07:00:00.000Z",
    );
  });

  it("respects daylight saving in New York", () => {
    expect(zonedTimeToUtc("2026-01-15T12:00", "America/New_York").toISOString()).toBe(
      "2026-01-15T17:00:00.000Z",
    );
    expect(zonedTimeToUtc("2026-07-15T12:00", "America/New_York").toISOString()).toBe(
      "2026-07-15T16:00:00.000Z",
    );
  });

  it("rejects malformed input", () => {
    expect(() => zonedTimeToUtc("2026-11-07", "UTC")).toThrow();
  });
});

describe("localDate", () => {
  it("shows the date in the given zone, not UTC", () => {
    // 22:30 UTC on the 6th is already the 7th in Kampala.
    expect(localDate("2026-11-06T22:30:00Z", "Africa/Kampala")).toBe("2026-11-07");
    expect(localDate("2026-11-06T22:30:00Z", "UTC")).toBe("2026-11-06");
  });
});

describe("calendar helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("builds a Monday-first grid that covers the month", () => {
    const grid = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday
    expect(grid[0]![0]).toBe("2026-10-26");
    expect(grid[0]![6]).toBe("2026-11-01");
    expect(grid.flat()).toContain("2026-11-30");
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });

  it("shifts months and validates input", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-11")).toBe(true);
    expect(isValidMonth(undefined)).toBe(false);
  });
});
