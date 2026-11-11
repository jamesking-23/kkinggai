import { createHash } from "node:crypto";

export type TrackPoint = { lat: number; lon: number; ele: number | null; t: number | null };

export type GpxTrack = {
  name: string | null;
  points: TrackPoint[];
};

const ATTR = (attrs: string, key: string): number | null => {
  const m = attrs.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']+)["']`));
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : null;
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

/**
 * Minimal GPX reader for track points. It uses pattern matching rather than an XML parser, so it never resolves
 * entities or external references. Points with invalid coordinates are skipped.
 */
export function parseGpx(text: string): GpxTrack {
  const points: TrackPoint[] = [];
  const re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lat = ATTR(m[1] ?? "", "lat");
    const lon = ATTR(m[1] ?? "", "lon");
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const body = m[2] ?? "";
    const ele = body.match(/<ele>\s*([-+0-9.eE]+)\s*<\/ele>/);
    const time = body.match(/<time>\s*([^<\s]+)\s*<\/time>/);
    const t = time ? Date.parse(time[1]!) : NaN;
    const e = ele ? Number(ele[1]) : NaN;
    points.push({ lat, lon, ele: Number.isFinite(e) ? e : null, t: Number.isFinite(t) ? t : null });
  }
  const trk = text.match(/<trk\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/);
  const meta = text.match(/<metadata\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/);
  const name = decode(trk?.[1] ?? meta?.[1] ?? "").slice(0, 200) || null;
  return { name, points };
}

const R = 6_371_000;
export function haversine(a: TrackPoint, b: TrackPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type TrackStats = {
  distanceM: number;
  movingSeconds: number;
  elapsedSeconds: number;
  elevationGainM: number;
  startedAt: Date;
  route: [number, number][];
};

const MAX_SPEED = 12; // m/s; faster segments are treated as GPS glitches and skipped
const MIN_SPEED = 0.3; // m/s; slower segments count as stopped
const MAX_GAP_S = 60; // longer gaps are treated as pauses
const ELE_THRESHOLD = 3; // metres of hysteresis so GPS noise is not counted as climbing

/** Computes distance, moving/elapsed time and elevation gain. Needs timestamps on the points. */
export function trackStats(
  points: TrackPoint[],
  maxRoutePoints = 500,
): TrackStats | { error: string } {
  if (points.length < 2) return { error: "The file has fewer than two track points." };
  if (points.some((p) => p.t === null))
    return { error: "The file has no timestamps, so duration cannot be worked out." };

  let distance = 0;
  let moving = 0;
  let gain = 0;
  let ref: number | null = points[0]!.ele;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = haversine(a, b);
    const dt = (b.t! - a.t!) / 1000;
    if (dt <= 0) continue;
    const speed = d / dt;
    if (speed <= MAX_SPEED) {
      distance += d;
      if (dt <= MAX_GAP_S && speed >= MIN_SPEED) moving += dt;
    }
    if (b.ele !== null && ref !== null) {
      if (b.ele - ref >= ELE_THRESHOLD) {
        gain += b.ele - ref;
        ref = b.ele;
      } else if (ref - b.ele >= ELE_THRESHOLD) ref = b.ele;
    } else if (b.ele !== null) ref = b.ele;
  }
  const elapsed = Math.round((points.at(-1)!.t! - points[0]!.t!) / 1000);
  if (distance < 1 || moving < 1 || elapsed < 1)
    return { error: "The track has no usable distance or time." };

  const step = Math.max(1, Math.ceil(points.length / maxRoutePoints));
  const route: [number, number][] = [];
  for (let i = 0; i < points.length; i += step)
    route.push([round5(points[i]!.lat), round5(points[i]!.lon)]);
  const lastP = points.at(-1)!;
  const lastR = route.at(-1)!;
  if (lastR[0] !== round5(lastP.lat) || lastR[1] !== round5(lastP.lon))
    route.push([round5(lastP.lat), round5(lastP.lon)]);

  return {
    distanceM: Math.round(distance),
    movingSeconds: Math.round(moving),
    elapsedSeconds: elapsed,
    elevationGainM: Math.round(gain),
    startedAt: new Date(points[0]!.t!),
    route: route.slice(0, 600),
  };
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Stable key so importing the same file twice does not create a duplicate. */
export function trackKey(points: TrackPoint[]): string {
  const first = points[0]!;
  const last = points.at(-1)!;
  return createHash("sha1")
    .update(`${first.t}|${last.t}|${points.length}|${first.lat.toFixed(5)}|${first.lon.toFixed(5)}`)
    .digest("hex");
}
