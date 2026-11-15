/**
 * Strava API client pieces. Everything takes an injectable fetch so it can be tested without the network.
 * Only read access to the user's own activities is requested.
 */

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class StravaError extends Error {}

export const STRAVA_SCOPE = "activity:read_all";
const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

export function authorizeUrl(p: { clientId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state: p.state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  athleteId: number | null;
};

async function tokenRequest(f: FetchLike, params: Record<string, string>): Promise<Tokens> {
  let res;
  try {
    res = await f(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new StravaError("Could not reach Strava. Try again later.");
  }
  if (res.status === 400 || res.status === 401)
    throw new StravaError("Strava rejected the request. Reconnect your account.");
  if (!res.ok) throw new StravaError(`Strava returned an error (${res.status}).`);
  const b = (await res.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_at?: unknown;
    athlete?: { id?: unknown };
  };
  if (
    typeof b.access_token !== "string" ||
    typeof b.refresh_token !== "string" ||
    typeof b.expires_at !== "number"
  )
    throw new StravaError("Strava returned an unexpected response.");
  const id = b.athlete?.id;
  return {
    accessToken: b.access_token,
    refreshToken: b.refresh_token,
    expiresAt: new Date(b.expires_at * 1000),
    athleteId: typeof id === "number" ? id : null,
  };
}

export const exchangeCode = (
  f: FetchLike,
  c: { clientId: string; clientSecret: string; code: string },
) =>
  tokenRequest(f, {
    client_id: c.clientId,
    client_secret: c.clientSecret,
    code: c.code,
    grant_type: "authorization_code",
  });

export const refreshTokens = (
  f: FetchLike,
  c: { clientId: string; clientSecret: string; refreshToken: string },
) =>
  tokenRequest(f, {
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
    grant_type: "refresh_token",
  });

/** True when the access token is expired or about to be. */
export const needsRefresh = (expiresAt: Date, now: Date, marginSeconds = 120) =>
  expiresAt.getTime() - now.getTime() < marginSeconds * 1000;

export type StravaActivity = {
  id: number;
  name?: string;
  type?: string;
  sport_type?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  start_date?: string;
  average_heartrate?: number;
  workout_type?: number | null;
  trainer?: boolean;
  map?: { summary_polyline?: string | null };
};

/** One page of the athlete's activities (newest first) after a given time. */
export async function fetchActivitiesPage(
  f: FetchLike,
  accessToken: string,
  afterEpochSeconds: number,
  page: number,
): Promise<StravaActivity[]> {
  let res;
  try {
    res = await f(
      `${API}/athlete/activities?after=${afterEpochSeconds}&per_page=100&page=${page}`,
      {
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    throw new StravaError("Could not reach Strava. Try again later.");
  }
  if (res.status === 401)
    throw new StravaError("Strava access was refused. Reconnect your account.");
  if (res.status === 429)
    throw new StravaError("Strava is rate limiting requests. Try again in 15 minutes.");
  if (!res.ok) throw new StravaError(`Strava returned an error (${res.status}).`);
  const body = await res.json();
  return Array.isArray(body)
    ? (body as StravaActivity[]).filter((a) => a && typeof a.id === "number")
    : [];
}

/** Decodes a Google-encoded polyline into [lat, lon] pairs. Stops cleanly on malformed input. */
export function decodePolyline(encoded: string, maxPoints = 100_000): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (i >= encoded.length) return null;
      b = encoded.charCodeAt(i++) - 63;
      if (b < 0 || b > 63) return null;
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (shift > 35) return null;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length && out.length < maxPoints) {
    const dLat = next();
    const dLon = next();
    if (dLat === null || dLon === null) break;
    lat += dLat;
    lon += dLon;
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

export type RunRow = {
  source: "strava";
  external_id: string;
  name: string;
  kind: string;
  started_at: string;
  distance_m: number;
  moving_seconds: number;
  elapsed_seconds: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  route: [number, number][] | null;
};

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

/** Maps a Strava activity to a run row, or null if it is not a run or its data is unusable. */
export function mapActivity(a: StravaActivity, maxRoutePoints = 500): RunRow | null {
  const type = a.sport_type ?? a.type ?? "";
  if (!RUN_TYPES.has(type)) return null;
  const distance = Math.round(a.distance ?? 0);
  const moving = Math.round(a.moving_time ?? 0);
  if (distance < 1 || distance > 1_000_000 || moving < 1 || moving > 864_000) return null;
  const started = a.start_date ? new Date(a.start_date) : null;
  if (!started || Number.isNaN(started.getTime())) return null;

  const elapsed = Math.round(a.elapsed_time ?? 0);
  const kind =
    type === "VirtualRun" || a.trainer
      ? "treadmill"
      : type === "TrailRun"
        ? "trail"
        : a.workout_type === 1
          ? "race"
          : a.workout_type === 2
            ? "long"
            : a.workout_type === 3
              ? "intervals"
              : "easy";

  let route: [number, number][] | null = null;
  const poly = a.map?.summary_polyline;
  if (poly) {
    const pts = decodePolyline(poly).filter(
      ([la, lo]) => Math.abs(la) <= 90 && Math.abs(lo) <= 180,
    );
    if (pts.length >= 2) {
      const step = Math.max(1, Math.ceil(pts.length / maxRoutePoints));
      route = pts.filter((_, idx) => idx % step === 0);
      if (route.at(-1) !== pts.at(-1)) route.push(pts.at(-1)!);
      route = route.slice(0, 600);
    }
  }
  const hr = a.average_heartrate ? Math.round(a.average_heartrate) : null;
  return {
    source: "strava",
    external_id: String(a.id),
    name: (a.name?.trim() || "Run").slice(0, 200),
    kind,
    started_at: started.toISOString(),
    distance_m: distance,
    moving_seconds: moving,
    elapsed_seconds: elapsed >= moving ? elapsed : moving,
    elevation_gain_m:
      a.total_elevation_gain === undefined
        ? null
        : Math.min(20000, Math.max(0, Math.round(a.total_elevation_gain))),
    avg_hr: hr !== null && hr >= 30 && hr <= 250 ? hr : null,
    route,
  };
}
