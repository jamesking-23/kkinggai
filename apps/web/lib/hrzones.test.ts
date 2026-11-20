import { describe, expect, it } from "vitest";
import { hrHistogram, parseBuckets, weeklyZones, zoneBreakdown } from "./hrzones";

const pt = (t: number, hr: number | null) => ({ lat: 0, lon: 0, ele: null, t: t * 1000, hr });
const steady = (n: number, hr: number, step = 5) =>
  Array.from({ length: n }, (_, i) => pt(i * step, hr));

describe("hrHistogram", () => {
  it("adds the time between samples to the right 5 bpm bucket", () => {
    const h = hrHistogram([
      ...steady(20, 142),
      ...steady(20, 151).map((p) => ({ ...p, t: p.t! + 200_000 })),
    ]);
    expect(h).not.toBeNull();
    expect(h!["140"]).toBeGreaterThan(80);
    expect(h!["150"]).toBeGreaterThan(0);
  });
  it("ignores pauses longer than 30 seconds", () => {
    const pts = [...steady(15, 140), pt(5000, 140), pt(5005, 140)];
    const total = Object.values(hrHistogram(pts)!).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(120); // not ~5000
  });
  it("returns null with too little heart-rate data", () => {
    expect(hrHistogram(steady(5, 140))).toBeNull();
    expect(hrHistogram(steady(20, 140, 1))).toBeNull(); // only ~19 s
    expect(hrHistogram(steady(30, 0).map((p) => ({ ...p, hr: null })))).toBeNull();
    expect(hrHistogram([])).toBeNull();
  });
  it("skips points without a timestamp", () => {
    expect(hrHistogram(steady(30, 140).map((p) => ({ ...p, t: null })))).toBeNull();
  });
});

describe("parseBuckets", () => {
  it("keeps well-formed entries only", () => {
    expect(parseBuckets({ "140": 30, bad: 5, "150": "x", "160": -1 })).toEqual({ "140": 30 });
    expect(parseBuckets([1])).toBeNull();
    expect(parseBuckets(null)).toBeNull();
    expect(parseBuckets({})).toBeNull();
  });
});

describe("zoneBreakdown", () => {
  it("places buckets into zones by share of max heart rate", () => {
    // max 200: 100-104 -> 51% z1, 130-134 -> 66% z2, 150-154 -> 76% z3, 170-174 -> 86% z4, 190-194 -> 96% z5, 80 -> below
    const r = zoneBreakdown(
      { "80": 10, "100": 60, "130": 60, "150": 60, "170": 60, "190": 60 },
      200,
    );
    expect(r.below).toBe(10);
    expect(r.total).toBe(310);
    expect(r.zones.map((z) => z.seconds)).toEqual([60, 60, 60, 60, 60]);
    expect(r.zones[0]!.share).toBeCloseTo(60 / 310);
  });
  it("moves a run to harder zones when max heart rate is lower", () => {
    const b = { "150": 100 };
    expect(zoneBreakdown(b, 200).zones[2]!.seconds).toBe(100); // 76 %
    expect(zoneBreakdown(b, 165).zones[4]!.seconds).toBe(100); // 93 %
  });
  it("labels ranges in bpm", () => {
    const z = zoneBreakdown({ "150": 10 }, 200).zones;
    expect(z[1]!.range).toBe("120-139 bpm");
    expect(z[4]!.range).toBe("180+ bpm");
  });
  it("copes with no time", () => {
    expect(zoneBreakdown({}, 190).zones.every((z) => z.share === 0)).toBe(true);
  });
});

describe("weeklyZones", () => {
  const now = new Date("2026-11-20T09:00:00Z"); // Friday; week starts Monday 2026-11-16
  const run = (started_at: string, buckets: unknown) => ({ started_at, hr_buckets: buckets });
  it("adds runs into their week and zone, oldest week first", () => {
    const w = weeklyZones(
      [
        run("2026-11-17T05:00:00Z", { "130": 600 }), // z2 at max 200
        run("2026-11-18T05:00:00Z", { "130": 300, "190": 60 }), // z2 + z5
        run("2026-11-09T05:00:00Z", { "150": 100 }), // previous week, z3
      ],
      200,
      now,
      "UTC",
      3,
    );
    expect(w.map((x) => x.weekStart)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(w[2]!.seconds).toEqual([0, 900, 0, 0, 60]);
    expect(w[2]!.total).toBe(960);
    expect(w[1]!.seconds[2]).toBe(100);
    expect(w[0]!.total).toBe(0);
  });
  it("ignores runs without data and runs outside the window", () => {
    const w = weeklyZones(
      [run("2026-11-17T05:00:00Z", null), run("2025-01-01T05:00:00Z", { "130": 50 })],
      200,
      now,
      "UTC",
      3,
    );
    expect(w.every((x) => x.total === 0)).toBe(true);
  });
  it("uses the time zone to place a late-night run", () => {
    // 22:30 UTC Sunday 15th is Monday 16th 01:30 in Kampala (UTC+3): belongs to the week starting the 16th.
    const r = [run("2026-11-15T22:30:00Z", { "130": 60 })];
    expect(weeklyZones(r, 200, now, "Africa/Kampala", 1)[0]!.total).toBe(60);
    expect(weeklyZones(r, 200, now, "UTC", 2)[0]!.total).toBe(60); // previous week in UTC
  });
});
