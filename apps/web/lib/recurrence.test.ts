import { describe, expect, it } from "vitest";
import {
  idForRule,
  labelForRule,
  nextDueDate,
  nextOccurrence,
  RECURRENCES,
  ruleFor,
} from "./recurrence";

describe("nextOccurrence", () => {
  it("handles daily and weekly", () => {
    expect(nextOccurrence("FREQ=DAILY", "2026-12-31")).toBe("2027-01-01");
    expect(nextOccurrence("FREQ=WEEKLY", "2026-11-19")).toBe("2026-11-26");
  });
  it("skips weekends for weekdays", () => {
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-11-19")).toBe("2026-11-20"); // Thu -> Fri
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-11-20")).toBe("2026-11-23"); // Fri -> Mon
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "2026-11-21")).toBe("2026-11-23"); // Sat -> Mon
  });
  it("keeps the day of month, clamped to the month's end, and crosses years", () => {
    expect(nextOccurrence("FREQ=MONTHLY", "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence("FREQ=MONTHLY", "2028-01-31")).toBe("2028-02-29");
    expect(nextOccurrence("FREQ=MONTHLY", "2026-12-15")).toBe("2027-01-15");
    expect(nextOccurrence("FREQ=YEARLY", "2028-02-29")).toBe("2029-02-28");
    expect(nextOccurrence("FREQ=YEARLY", "2026-06-10")).toBe("2027-06-10");
  });
  it("returns null for an unknown rule", () => {
    expect(nextOccurrence("FREQ=SECONDLY", "2026-01-01")).toBeNull();
  });
});

describe("nextDueDate", () => {
  it("is the next occurrence after the due date when that is today or later", () => {
    expect(nextDueDate("FREQ=WEEKLY", "2026-11-19", "2026-11-19")).toBe("2026-11-26");
    expect(nextDueDate("FREQ=DAILY", "2026-11-18", "2026-11-19")).toBe("2026-11-19");
  });
  it("skips occurrences already in the past", () => {
    expect(nextDueDate("FREQ=DAILY", "2026-11-01", "2026-11-19")).toBe("2026-11-19");
    expect(nextDueDate("FREQ=WEEKLY", "2026-10-01", "2026-11-19")).toBe("2026-11-19");
    expect(nextDueDate("FREQ=MONTHLY", "2026-06-05", "2026-11-19")).toBe("2026-12-05");
  });
  it("starts from today when there is no due date", () => {
    expect(nextDueDate("FREQ=DAILY", null, "2026-11-19")).toBe("2026-11-20");
  });
  it("returns null for an unknown rule", () => {
    expect(nextDueDate("nope", "2026-11-19", "2026-11-19")).toBeNull();
  });
});

describe("rule helpers", () => {
  it("round-trips ids, rules and labels", () => {
    for (const r of RECURRENCES) {
      expect(ruleFor(r.id)).toBe(r.rule);
      expect(idForRule(r.rule)).toBe(r.id);
      expect(labelForRule(r.rule)).toBe(r.label);
    }
    expect(ruleFor("hourly")).toBeNull();
    expect(idForRule(null)).toBe("");
    expect(labelForRule("FREQ=HOURLY")).toBeNull();
  });
});
