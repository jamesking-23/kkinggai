import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { averageHr, parseTcx, parseTrackFile } from "./trackfile";
import { trackStats } from "./gpx";

function tcx(n: number, hr = true) {
  const pts = Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.UTC(2026, 10, 1, 6, 0, i * 5)).toISOString();
    return `<Trackpoint><Time>${t}</Time><Position><LatitudeDegrees>${(0.3 + i * 0.00004).toFixed(6)}</LatitudeDegrees><LongitudeDegrees>32.5</LongitudeDegrees></Position><AltitudeMeters>1200</AltitudeMeters>${hr ? "<HeartRateBpm><Value>150</Value></HeartRateBpm>" : ""}</Trackpoint>`;
  });
  return `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-11-01T06:00:00Z</Id><Lap StartTime="x"><Track>${pts.join("")}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
}
const enc = (s: string) => new TextEncoder().encode(s);

describe("parseTcx", () => {
  it("reads positions, time, altitude and heart rate", () => {
    const t = parseTcx(tcx(30));
    expect(t.points).toHaveLength(30);
    expect(t.points[0]).toMatchObject({ lon: 32.5, ele: 1200, hr: 150 });
    expect(t.points[0]!.t).toBe(Date.UTC(2026, 10, 1, 6, 0, 0));
    const s = trackStats(t.points);
    expect("error" in s).toBe(false);
  });
  it("skips trackpoints without a position", () => {
    const t = parseTcx(
      "<TrainingCenterDatabase><Trackpoint><Time>2026-11-01T06:00:00Z</Time></Trackpoint></TrainingCenterDatabase>",
    );
    expect(t.points).toHaveLength(0);
  });
  it("ignores implausible heart rates", () => {
    const t = parseTcx(tcx(1).replace("<Value>150", "<Value>999"));
    expect(t.points[0]!.hr).toBeNull();
  });
});

describe("parseTrackFile", () => {
  it("detects TCX and GPX by content", () => {
    expect("track" in parseTrackFile("a.tcx", enc(tcx(5)))).toBe(true);
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="0.3" lon="32.5"><time>2026-11-01T06:00:00Z</time></trkpt></trkseg></trk></gpx>`;
    const r = parseTrackFile("a.gpx", enc(gpx));
    expect("track" in r && r.track.points).toHaveLength(1);
  });
  it("unzips gzipped files whatever the name", () => {
    const r = parseTrackFile("a.tcx.gz", gzipSync(tcx(5)));
    expect("track" in r && r.track.points).toHaveLength(5);
  });
  it("rejects FIT, other XML and corrupt gzip", () => {
    expect(parseTrackFile("a.fit", new Uint8Array([1, 2]))).toHaveProperty("error");
    expect(parseTrackFile("a.gpx", enc("<html></html>"))).toEqual({
      error: "Not a GPX or TCX file.",
    });
    expect(parseTrackFile("a.gpx.gz", new Uint8Array([0x1f, 0x8b, 1, 2, 3]))).toEqual({
      error: "Could not unzip this file.",
    });
  });
  it("refuses a gzip bomb", () => {
    const bomb = gzipSync(Buffer.alloc(30_000_000, 32));
    expect(parseTrackFile("b.gpx.gz", bomb)).toEqual({ error: "Could not unzip this file." });
  });
});

describe("averageHr", () => {
  it("averages samples and needs at least 10", () => {
    expect(averageHr(parseTcx(tcx(20)).points)).toBe(150);
    expect(averageHr(parseTcx(tcx(5)).points)).toBeNull();
    expect(averageHr(parseTcx(tcx(20, false)).points)).toBeNull();
  });
});
