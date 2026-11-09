import { describe, expect, it } from "vitest";
import { dueSoon, formatRange, pipelineCounts, sortEntries } from "./career";

describe("pipelineCounts", () => {
  it("counts in pipeline order including zeros", () => {
    const c = pipelineCounts([
      { status: "applied", deadline: null },
      { status: "applied", deadline: null },
      { status: "offer", deadline: null },
    ]);
    expect(c.map((x) => x.status)).toEqual([
      "wishlist",
      "applied",
      "interviewing",
      "offer",
      "rejected",
      "withdrawn",
    ]);
    expect(c.find((x) => x.status === "applied")?.count).toBe(2);
    expect(c.find((x) => x.status === "wishlist")?.count).toBe(0);
  });
});

describe("dueSoon", () => {
  const apps = [
    { status: "wishlist", deadline: "2026-11-12" },
    { status: "applied", deadline: "2026-11-30" },
    { status: "rejected", deadline: "2026-11-10" },
    { status: "interviewing", deadline: "2026-11-09" },
    { status: "wishlist", deadline: "2026-11-08" },
    { status: "wishlist", deadline: null },
  ];
  it("lists open applications due within the window, soonest first, excluding past and closed ones", () => {
    expect(dueSoon(apps, "2026-11-09", 14).map((a) => a.deadline)).toEqual([
      "2026-11-09",
      "2026-11-12",
    ]);
  });
});

describe("formatRange", () => {
  it("formats open, closed and missing ranges", () => {
    expect(formatRange("2023-01-15", null)).toBe("Jan 2023 – Present");
    expect(formatRange("2023-01-15", "2024-06-30")).toBe("Jan 2023 – Jun 2024");
    expect(formatRange(null, "2024-06-30")).toBe("Jun 2024");
    expect(formatRange(null, null)).toBe("");
  });
});

describe("sortEntries", () => {
  it("orders by sort order, then newest start date, undated last", () => {
    const e = [
      { kind: "x", start_date: null, end_date: null, sort_order: 0, n: "undated" },
      { kind: "x", start_date: "2020-01-01", end_date: null, sort_order: 0, n: "old" },
      { kind: "x", start_date: "2024-01-01", end_date: null, sort_order: 0, n: "new" },
      { kind: "x", start_date: "2010-01-01", end_date: null, sort_order: -1, n: "pinned" },
    ];
    expect(sortEntries(e).map((x) => x.n)).toEqual(["pinned", "new", "old", "undated"]);
  });
});
