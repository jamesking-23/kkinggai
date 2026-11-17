import { describe, expect, it } from "vitest";
import { nextOccurrence, upcoming } from "./personal";

describe("nextOccurrence", () => {
  it("counts today as day 0", () => {
    expect(nextOccurrence({ month: 11, day: 17, year: 2000 }, "2026-11-17")).toEqual({
      date: "2026-11-17",
      daysAway: 0,
      turning: 26,
    });
  });
  it("rolls over to next year once the date has passed", () => {
    const n = nextOccurrence({ month: 3, day: 14, year: 1970 }, "2026-11-17");
    expect(n.date).toBe("2027-03-14");
    expect(n.daysAway).toBe(117);
    expect(n.turning).toBe(57);
  });
  it("has no age when no year was recorded", () => {
    expect(nextOccurrence({ month: 12, day: 25, year: null }, "2026-11-17").turning).toBeNull();
  });
  it("observes 29 February on the 28th in non-leap years only", () => {
    expect(nextOccurrence({ month: 2, day: 29, year: null }, "2026-11-17").date).toBe("2027-02-28");
    expect(nextOccurrence({ month: 2, day: 29, year: null }, "2027-11-17").date).toBe("2028-02-29");
  });
});

describe("upcoming", () => {
  it("sorts by how soon and filters by window", () => {
    const rows = [
      { id: "a", month: 3, day: 14, year: null },
      { id: "b", month: 11, day: 20, year: null },
      { id: "c", month: 12, day: 1, year: null },
    ];
    expect(upcoming(rows, "2026-11-17").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(upcoming(rows, "2026-11-17", 30).map((r) => r.id)).toEqual(["b", "c"]);
  });
});
