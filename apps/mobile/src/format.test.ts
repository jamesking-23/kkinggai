import { describe, expect, it } from "vitest";
import { dueLabel, isSafeLink, timeAgo } from "./format";

const now = new Date("2026-11-17T12:00:00Z");

describe("timeAgo", () => {
  it("uses coarse relative units", () => {
    expect(timeAgo("2026-11-17T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-11-17T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-11-17T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-11-15T12:00:00Z", now)).toBe("2 d ago");
    expect(timeAgo("2026-10-01T12:00:00Z", now)).toBe("2026-10-01");
  });
  it("tolerates bad input and future times", () => {
    expect(timeAgo("nonsense", now)).toBe("");
    expect(timeAgo("2026-11-18T12:00:00Z", now)).toBe("just now");
  });
});

describe("dueLabel", () => {
  it("compares calendar days", () => {
    expect(dueLabel(null, now)).toBe("");
    expect(dueLabel("2026-11-16T23:59:00Z", now)).toBe("Overdue");
    expect(dueLabel("2026-11-17T23:59:00Z", now)).toBe("Due today");
    expect(dueLabel("2026-11-18T00:00:00Z", now)).toBe("Due tomorrow");
    expect(dueLabel("2026-11-30T08:00:00Z", now)).toBe("Due 2026-11-30");
  });
});

describe("isSafeLink", () => {
  it("accepts only plain app paths", () => {
    expect(isSafeLink("/chess/train")).toBe(true);
    expect(isSafeLink("https://evil.example")).toBe(false);
    expect(isSafeLink("//evil.example")).toBe(false);
    expect(isSafeLink("javascript:alert(1)")).toBe(false);
    expect(isSafeLink(null)).toBe(false);
  });
});
