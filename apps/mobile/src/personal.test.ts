import { describe, expect, it } from "vitest";
import {
  checkDate,
  checkJournal,
  daysAwayText,
  moodText,
  nextOccurrence,
  upcoming,
} from "./personal";

describe("personal", () => {
  it("finds the next occurrence, counting today as day 0", () => {
    expect(nextOccurrence({ month: 11, day: 24, year: 2000 }, "2026-11-24")).toEqual({
      date: "2026-11-24",
      daysAway: 0,
      turning: 26,
    });
    expect(nextOccurrence({ month: 11, day: 23, year: null }, "2026-11-24")).toEqual({
      date: "2027-11-23",
      daysAway: 364,
      turning: null,
    });
  });

  it("observes 29 February on the 28th in non-leap years", () => {
    expect(nextOccurrence({ month: 2, day: 29, year: null }, "2027-01-01").date).toBe("2027-02-28");
    expect(nextOccurrence({ month: 2, day: 29, year: null }, "2028-01-01").date).toBe("2028-02-29");
  });

  it("orders by how soon", () => {
    const out = upcoming(
      [
        { id: "far", month: 6, day: 1, year: null },
        { id: "near", month: 12, day: 1, year: null },
      ],
      "2026-11-24",
    );
    expect(out.map((x) => x.id)).toEqual(["near", "far"]);
  });

  it("words days away", () => {
    expect(daysAwayText(0)).toBe("Today");
    expect(daysAwayText(1)).toBe("Tomorrow");
    expect(daysAwayText(9)).toBe("In 9 days");
  });

  it("validates important dates", () => {
    expect(checkDate(" Mum ", "3", "9", "1970", "")).toEqual({
      title: "Mum",
      month: 3,
      day: 9,
      year: 1970,
      notes: "",
    });
    expect(checkDate("x", "2", "30", "", "")).toBe("That date does not exist.");
    expect(checkDate("x", "13", "1", "", "")).toBe("Month must be 1 to 12.");
    expect(checkDate("", "1", "1", "", "")).toBe("Enter a title.");
    expect(checkDate("x", "1", "1", "1800", "")).toMatch(/Year/);
    expect(checkDate("x", "2", "29", "", "")).not.toBeTypeOf("string");
  });

  it("validates journal entries", () => {
    expect(checkJournal(" hi ", "Run, Family ,")).toEqual({ body: "hi", tags: ["run", "family"] });
    expect(checkJournal("  ", "")).toBe("Write something first.");
    expect(checkJournal("x", "a,".repeat(21))).toBe("Use at most 20 tags.");
    expect(moodText(4)).toBe("Good");
    expect(moodText(null)).toBe("");
  });
});
