import { describe, expect, it } from "vitest";
import {
  cleanName,
  formatDuration,
  formatKm,
  formatPace,
  parseDistanceM,
  parseDurationSeconds,
  startedAt,
  summarise,
  weekStart,
  type RunRow,
} from "./running";

const run = (id: string, started_at: string, km: number, sec: number): RunRow => ({
  id,
  name: id,
  kind: "easy",
  started_at,
  distance_m: km * 1000,
  moving_seconds: sec,
});

describe("running helpers", () => {
  it("formats pace, duration and distance", () => {
    expect(formatPace(5000, 1500)).toBe("5:00/km");
    expect(formatPace(1000, 359.7)).toBe("6:00/km");
    expect(formatPace(0, 100)).toBe("–");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatKm(5250)).toBe("5.25 km");
    expect(formatKm(120000)).toBe("120 km");
  });

  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(weekStart("2026-11-29")).toBe("2026-11-23");
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });

  it("summarises week, month, all time and weekly bars", () => {
    const rows = [
      run("a", "2026-11-24T12:00:00Z", 5, 1500),
      run("b", "2026-11-02T12:00:00Z", 10, 3000),
      run("c", "2026-10-15T12:00:00Z", 8, 2400),
    ];
    const s = summarise(rows, "2026-11-25", (iso) => iso.slice(0, 10));
    expect(s.week).toEqual({ runs: 1, distanceM: 5000, movingSeconds: 1500 });
    expect(s.month.runs).toBe(2);
    expect(s.month.distanceM).toBe(15000);
    expect(s.all.runs).toBe(3);
    expect(s.weeks).toHaveLength(8);
    expect(s.weeks.at(-1)?.weekStart).toBe("2026-11-23");
    expect(s.weeks.at(-1)?.runs).toBe(1);
  });

  it("parses distance", () => {
    expect(parseDistanceM("5")).toBe(5000);
    expect(parseDistanceM(" 5,25 ")).toBe(5250);
    expect(parseDistanceM("0")).toBeNull();
    expect(parseDistanceM("abc")).toBeNull();
    expect(parseDistanceM("1001")).toBeNull();
  });

  it("parses duration", () => {
    expect(parseDurationSeconds("", "25", "30")).toBe(1530);
    expect(parseDurationSeconds("1", "0", "0")).toBe(3600);
    expect(parseDurationSeconds("", "", "")).toBeNull();
    expect(parseDurationSeconds("", "60", "")).toBeNull();
    expect(parseDurationSeconds("x", "1", "")).toBeNull();
  });

  it("builds the stored start time and cleans names", () => {
    expect(startedAt("2026-11-23")).toBe("2026-11-23T12:00:00Z");
    expect(cleanName("  Morning run ")).toBe("Morning run");
  });
});
