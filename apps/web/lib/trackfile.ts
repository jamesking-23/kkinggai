import { gunzipSync } from "node:zlib";
import { parseGpx, type GpxTrack } from "./gpx";

const num = (s: string | undefined) => {
  const n = s === undefined ? NaN : Number(s);
  return Number.isFinite(n) ? n : null;
};
const tag = (body: string, name: string) =>
  body.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`))?.[1];

/**
 * Minimal TCX reader (Garmin Training Center format, used by Strava and MapMyRun exports). Pattern matching rather than
 * an XML parser, so entities and external references are never resolved. Trackpoints without a position are skipped.
 */
export function parseTcx(text: string): GpxTrack {
  const points: GpxTrack["points"] = [];
  const re = /<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = m[1] ?? "";
    const lat = num(tag(body, "LatitudeDegrees"));
    const lon = num(tag(body, "LongitudeDegrees"));
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const t = Date.parse(tag(body, "Time") ?? "");
    const hr = num(body.match(/<HeartRateBpm\b[^>]*>\s*<Value>\s*(\d+)\s*<\/Value>/)?.[1]);
    points.push({
      lat,
      lon,
      ele: num(tag(body, "AltitudeMeters")),
      t: Number.isFinite(t) ? t : null,
      hr: hr !== null && hr >= 30 && hr <= 250 ? hr : null,
    });
  }
  const id = tag(text.match(/<Activity\b[^>]*>[\s\S]*?(?=<Lap\b)/)?.[0] ?? "", "Id");
  const name = tag(text.match(/<Activity\b[^>]*>[\s\S]*?<\/Activity>/)?.[0] ?? "", "Notes");
  return { name: (name ?? id ?? "").slice(0, 200) || null, points };
}

export type ParsedFile = { track: GpxTrack } | { error: string };

const MAX_UNZIPPED = 20_000_000;

/**
 * Reads an exported workout file: .gpx or .tcx, optionally gzipped (Strava's bulk export ships .gpx.gz and .tcx.gz).
 * FIT files are binary and not supported.
 */
export function parseTrackFile(name: string, bytes: Uint8Array): ParsedFile {
  const lower = name.toLowerCase();
  if (lower.endsWith(".fit") || lower.endsWith(".fit.gz"))
    return { error: "FIT files are not supported. Export GPX or TCX instead." };
  let data = Buffer.from(bytes);
  if (data[0] === 0x1f && data[1] === 0x8b) {
    try {
      data = gunzipSync(data, { maxOutputLength: MAX_UNZIPPED });
    } catch {
      return { error: "Could not unzip this file." };
    }
  }
  const text = data.toString("utf8");
  const head = text.slice(0, 2000);
  const track = /<TrainingCenterDatabase\b/.test(head)
    ? parseTcx(text)
    : /<gpx\b/.test(head)
      ? parseGpx(text)
      : null;
  if (!track) return { error: "Not a GPX or TCX file." };
  return { track };
}

/** Mean of the heart-rate samples, or null when fewer than 10 points have one. */
export function averageHr(points: GpxTrack["points"]): number | null {
  const v = points.map((p) => p.hr).filter((h): h is number => typeof h === "number");
  if (v.length < 10) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}
