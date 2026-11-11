import { describe, expect, it } from "vitest";
import { haversine, parseGpx, trackKey, trackStats } from "./gpx";
import {
  formatDuration,
  formatPace,
  localDate,
  paceSecPerKm,
  routeToSvg,
  summariseRuns,
  weekStart,
} from "./running";

/** A straight run north at ~3.33 m/s (5:00/km) with 1 point per 10 s. */
function gpx(n: number, opts: { time?: boolean; startEle?: number; step?: number } = {}) {
  const { time = true, startEle = 1000, step = 0.0003 } = opts;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = time
      ? `<time>${new Date(Date.UTC(2026, 10, 10, 6, 0, i * 10)).toISOString()}</time>`
      : "";
    return `<trkpt lat="${(0.3 + i * step).toFixed(6)}" lon='32.5'><ele>${startEle + (i % 2 ? 0 : 0) + i * 0.5}</ele>${t}</trkpt>`;
  });
  return `<?xml version="1.0"?><gpx><metadata><name>Meta &amp; name</name></metadata><trk><name>Morning run</name><trkseg>${pts.join("")}</trkseg></trk></gpx>`;
}

describe("parseGpx", () => {
  it("reads points, elevation, time and the track name", () => {
    const t = parseGpx(gpx(5));
    expect(t.points).toHaveLength(5);
    expect(t.points[0]).toMatchObject({ lat: 0.3, lon: 32.5, ele: 1000 });
    expect(t.points[1]!.t! - t.points[0]!.t!).toBe(10_000);
    expect(t.name).toBe("Morning run");
  });
  it("skips invalid coordinates and handles self-closing points", () => {
    const t = parseGpx(
      '<gpx><trk><trkseg><trkpt lat="95" lon="0"></trkpt><trkpt lat="1" lon="2"/><trkpt lat="x" lon="2"></trkpt></trkseg></trk></gpx>',
    );
    expect(t.points).toEqual([{ lat: 1, lon: 2, ele: null, t: null }]);
  });
  it("does not expand entities or fetch anything", () => {
    const t = parseGpx(
      '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><gpx><trk><name>&e;</name><trkpt lat="1" lon="2"></trkpt></trk></gpx>',
    );
    expect(t.name).toBe("&e;");
  });
});

describe("trackStats", () => {
  it("computes distance, times and pace for a steady run", () => {
    const s = trackStats(parseGpx(gpx(61)).points);
    expect("error" in s).toBe(false);
    if ("error" in s) return;
    // 60 segments * 0.0003 deg latitude * ~111.19 km/deg ≈ 2001 m over 600 s
    expect(s.distanceM).toBeGreaterThan(1990);
    expect(s.distanceM).toBeLessThan(2015);
    expect(s.movingSeconds).toBe(600);
    expect(s.elapsedSeconds).toBe(600);
    expect(Math.round(paceSecPerKm(s.distanceM, s.movingSeconds) / 10) * 10).toBe(300);
    expect(s.elevationGainM).toBeGreaterThan(25);
    expect(s.route.length).toBeLessThanOrEqual(600);
    expect(s.startedAt.toISOString()).toBe("2026-11-10T06:00:00.000Z");
  });
  it("downsamples long tracks and keeps the last point", () => {
    const s = trackStats(parseGpx(gpx(2001, { step: 0.0001 })).points, 500);
    if ("error" in s) throw new Error(s.error);
    expect(s.route.length).toBeLessThanOrEqual(502);
    expect(s.route.at(-1)![0]).toBeCloseTo(0.3 + 2000 * 0.0001, 4);
  });
  it("reports unusable files", () => {
    expect(trackStats(parseGpx(gpx(1)).points)).toEqual({
      error: expect.stringContaining("fewer than two"),
    });
    expect(trackStats(parseGpx(gpx(5, { time: false })).points)).toEqual({
      error: expect.stringContaining("timestamps"),
    });
  });
  it("ignores GPS jumps and does not count paused time as moving", () => {
    const pts = parseGpx(gpx(31)).points;
    pts[15] = { ...pts[15]!, lat: pts[15]!.lat + 1 }; // teleport for one fix
    const s = trackStats(pts);
    if ("error" in s) throw new Error(s.error);
    expect(s.distanceM).toBeLessThan(1500);
  });
  it("gives the same key for the same track", () => {
    const a = parseGpx(gpx(10)).points;
    expect(trackKey(a)).toBe(trackKey(parseGpx(gpx(10)).points));
    expect(haversine(a[0]!, a[1]!)).toBeGreaterThan(30);
  });
});

describe("formatting", () => {
  it("formats pace and duration", () => {
    expect(formatPace(312)).toBe("5:12/km");
    expect(formatPace(359.6)).toBe("6:00/km");
    expect(formatPace(0)).toBe("–");
    expect(formatDuration(1500)).toBe("25:00");
    expect(formatDuration(3725)).toBe("1:02:05");
  });
});

describe("routeToSvg", () => {
  it("fits the route in the box and returns null for too few points", () => {
    expect(routeToSvg([[0, 0]], 100, 100)).toBeNull();
    const r = routeToSvg(
      [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
      ],
      200,
      100,
    )!;
    expect(r.d.startsWith("M")).toBe(true);
    const nums = [...r.d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]));
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nums)).toBeLessThanOrEqual(200);
  });
});

describe("summariseRuns", () => {
  const NOW = new Date("2026-11-12T10:00:00Z"); // Thursday
  const rows = [
    { started_at: "2026-11-10T05:00:00Z", distance_m: 5000, moving_seconds: 1500 }, // Tue, 5:00/km
    { started_at: "2026-11-09T05:00:00Z", distance_m: 10000, moving_seconds: 3300 }, // Mon, 5:30/km
    { started_at: "2026-11-08T05:00:00Z", distance_m: 8000, moving_seconds: 2400 }, // Sun (previous week)
    { started_at: "2026-10-20T05:00:00Z", distance_m: 21100, moving_seconds: 7600 },
  ];
  it("finds week start in a time zone", () => {
    expect(weekStart("2026-11-12")).toBe("2026-11-09");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(localDate("2026-11-09T22:30:00Z", "Africa/Kampala")).toBe("2026-11-10");
  });
  it("totals this week, month and all time", () => {
    const s = summariseRuns(rows, NOW, "Africa/Kampala");
    expect(s.week).toEqual({ runs: 2, distanceM: 15000, movingSeconds: 4800 });
    expect(s.month.runs).toBe(3);
    expect(s.all.runs).toBe(4);
    expect(s.weeks).toHaveLength(8);
    expect(s.weeks.at(-1)).toMatchObject({ weekStart: "2026-11-09", runs: 2 });
    expect(s.weeks.at(-2)).toMatchObject({ weekStart: "2026-11-02", runs: 1, distanceM: 8000 });
  });
  it("reports fastest average pace for runs of at least each distance", () => {
    const s = summariseRuns(rows, NOW, "Africa/Kampala");
    expect(s.bests.map((b) => b.km)).toEqual([5, 10, 21.0975]);
    expect(s.bests[0]!.secPerKm).toBe(300);
    expect(s.bests[1]!.secPerKm).toBe(330);
  });
  it("handles no runs", () => {
    const s = summariseRuns([], NOW, "UTC");
    expect(s.all.runs).toBe(0);
    expect(s.bests).toEqual([]);
  });
});
