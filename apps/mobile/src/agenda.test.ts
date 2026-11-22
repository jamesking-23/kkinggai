import { describe, expect, it } from "vitest";
import { buildAgenda, dayLabel, localDate, localTime, safeZone } from "./agenda";

const KLA = "Africa/Kampala"; // UTC+3, no daylight saving

describe("agenda helpers", () => {
  it("uses UTC for unknown zones", () => {
    expect(safeZone("Mars/Base")).toBe("UTC");
    expect(safeZone(null)).toBe("UTC");
    expect(safeZone(KLA)).toBe(KLA);
  });
  it("converts instants to local date and time", () => {
    expect(localDate("2026-11-22T21:30:00Z", KLA)).toBe("2026-11-23"); // after midnight local
    expect(localTime("2026-11-22T21:30:00Z", KLA)).toBe("00:30");
    expect(localTime("2026-11-23T06:05:00Z", KLA)).toBe("09:05");
    expect(localDate("nope", KLA)).toBe("");
    expect(localTime("nope", KLA)).toBe("");
  });
  it("labels days", () => {
    expect(dayLabel("2026-11-23", "2026-11-23")).toBe("Today");
    expect(dayLabel("2026-11-24", "2026-11-23")).toBe("Tomorrow");
    expect(dayLabel("2026-11-25", "2026-11-23")).toContain("25");
    expect(dayLabel("garbage", "2026-11-23")).toBe("garbage");
  });
  it("builds a sorted agenda, drops past days, puts events before tasks at the same time", () => {
    const now = new Date("2026-11-23T08:00:00Z"); // 11:00 local on the 23rd
    const events = [
      {
        id: "e2",
        title: "Late",
        location: "Lab",
        starts_at: "2026-11-24T10:00:00Z",
        ends_at: "2026-11-24T11:00:00Z",
      },
      {
        id: "e1",
        title: "Lecture",
        location: null,
        starts_at: "2026-11-23T11:00:00Z",
        ends_at: "2026-11-23T12:30:00Z",
      },
      {
        id: "old",
        title: "Yesterday",
        location: null,
        starts_at: "2026-11-22T09:00:00Z",
        ends_at: "2026-11-22T10:00:00Z",
      },
    ];
    const tasks = [
      { id: "t1", title: "Hand in", due_at: "2026-11-23T11:00:00Z" },
      { id: "t0", title: "Overdue", due_at: "2026-11-20T09:00:00Z" },
    ];
    const a = buildAgenda(events, tasks, KLA, now);
    expect(a.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-24"]);
    expect(a[0]!.items.map((i) => i.key)).toEqual(["e-e1", "t-t1"]);
    expect(a[0]!.items[0]!.detail).toBe("14:00–15:30");
    expect(a[1]!.items[0]!.detail).toBe("13:00–14:00 · Lab");
    expect(a[0]!.items[1]!.detail).toBe("Due 14:00");
  });
  it("handles an empty calendar and bad dates", () => {
    expect(buildAgenda([], [], KLA)).toEqual([]);
    expect(buildAgenda([], [{ id: "x", title: "t", due_at: "bad" }], KLA)).toEqual([]);
  });
});
