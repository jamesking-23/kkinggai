import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  decodePolyline,
  exchangeCode,
  fetchActivitiesPage,
  mapActivity,
  needsRefresh,
  refreshTokens,
  StravaError,
  type FetchLike,
} from "./strava";

const reply = (
  status: number,
  body: unknown,
): FetchLike & { calls: { url: string; body?: string }[] } => {
  const calls: { url: string; body?: string }[] = [];
  const f = async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return Object.assign(f, { calls });
};

describe("authorizeUrl", () => {
  it("asks only for activity read access and carries the state", () => {
    const u = new URL(
      authorizeUrl({
        clientId: "1",
        redirectUri: "https://x.test/api/strava/callback",
        state: "abc",
      }),
    );
    expect(u.origin + u.pathname).toBe("https://www.strava.com/oauth/authorize");
    expect(u.searchParams.get("scope")).toBe("activity:read_all");
    expect(u.searchParams.get("state")).toBe("abc");
    expect(u.searchParams.get("redirect_uri")).toBe("https://x.test/api/strava/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
  });
});

describe("token requests", () => {
  const ok = {
    access_token: "a".repeat(20),
    refresh_token: "r".repeat(20),
    expires_at: 1_800_000_000,
    athlete: { id: 42 },
  };
  it("exchanges a code and parses the tokens", async () => {
    const f = reply(200, ok);
    const t = await exchangeCode(f, { clientId: "1", clientSecret: "s", code: "c" });
    expect(t).toMatchObject({
      accessToken: ok.access_token,
      refreshToken: ok.refresh_token,
      athleteId: 42,
    });
    expect(t.expiresAt.getTime()).toBe(1_800_000_000_000);
    expect(f.calls[0]!.body).toContain("grant_type=authorization_code");
  });
  it("refreshes with the refresh token", async () => {
    const f = reply(200, { ...ok, athlete: undefined });
    const t = await refreshTokens(f, { clientId: "1", clientSecret: "s", refreshToken: "old" });
    expect(t.athleteId).toBeNull();
    expect(f.calls[0]!.body).toContain("grant_type=refresh_token");
    expect(f.calls[0]!.body).toContain("refresh_token=old");
  });
  it("turns rejections and bad bodies into readable errors", async () => {
    await expect(
      exchangeCode(reply(400, {}), { clientId: "1", clientSecret: "s", code: "c" }),
    ).rejects.toThrow("rejected");
    await expect(
      exchangeCode(reply(500, {}), { clientId: "1", clientSecret: "s", code: "c" }),
    ).rejects.toBeInstanceOf(StravaError);
    await expect(
      exchangeCode(reply(200, { access_token: 1 }), {
        clientId: "1",
        clientSecret: "s",
        code: "c",
      }),
    ).rejects.toThrow("unexpected");
  });
  it("decides when to refresh", () => {
    const now = new Date("2026-11-15T10:00:00Z");
    expect(needsRefresh(new Date("2026-11-15T10:01:00Z"), now)).toBe(true);
    expect(needsRefresh(new Date("2026-11-15T16:00:00Z"), now)).toBe(false);
  });
});

describe("fetchActivitiesPage", () => {
  it("sends a bearer token and returns activities with ids", async () => {
    const f = reply(200, [{ id: 1 }, { nope: true }, { id: 2 }]);
    const rows = await fetchActivitiesPage(f, "tok", 1700000000, 2);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(f.calls[0]!.url).toBe(
      "https://www.strava.com/api/v3/athlete/activities?after=1700000000&per_page=100&page=2",
    );
  });
  it("maps errors", async () => {
    await expect(fetchActivitiesPage(reply(401, {}), "t", 0, 1)).rejects.toThrow("Reconnect");
    await expect(fetchActivitiesPage(reply(429, {}), "t", 0, 1)).rejects.toThrow("rate limiting");
    expect(await fetchActivitiesPage(reply(200, { not: "an array" }), "t", 0, 1)).toEqual([]);
  });
});

describe("decodePolyline", () => {
  it("decodes the reference example from the encoding specification", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });
  it("stops cleanly on garbage or truncated input", () => {
    expect(decodePolyline("")).toEqual([]);
    expect(decodePolyline("_p~iF~ps|U_ulL")).toHaveLength(1);
    expect(decodePolyline("\u0001\u0002")).toEqual([]);
  });
});

describe("mapActivity", () => {
  const base = {
    id: 99,
    name: " Lunch run ",
    sport_type: "Run",
    distance: 5012.4,
    moving_time: 1500,
    elapsed_time: 1560,
    total_elevation_gain: 41.6,
    start_date: "2026-11-10T06:00:00Z",
    average_heartrate: 151.2,
    map: { summary_polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
  };
  it("maps a normal run", () => {
    expect(mapActivity(base)).toMatchObject({
      source: "strava",
      external_id: "99",
      name: "Lunch run",
      kind: "easy",
      started_at: "2026-11-10T06:00:00.000Z",
      distance_m: 5012,
      moving_seconds: 1500,
      elapsed_seconds: 1560,
      elevation_gain_m: 42,
      avg_hr: 151,
    });
    expect(mapActivity(base)!.route).toHaveLength(3);
  });
  it("derives the kind from the type and workout flag", () => {
    expect(mapActivity({ ...base, workout_type: 1 })!.kind).toBe("race");
    expect(mapActivity({ ...base, workout_type: 2 })!.kind).toBe("long");
    expect(mapActivity({ ...base, workout_type: 3 })!.kind).toBe("intervals");
    expect(mapActivity({ ...base, sport_type: "TrailRun" })!.kind).toBe("trail");
    expect(mapActivity({ ...base, trainer: true })!.kind).toBe("treadmill");
    expect(mapActivity({ ...base, sport_type: "VirtualRun" })!.kind).toBe("treadmill");
  });
  it("skips other sports and unusable data", () => {
    expect(mapActivity({ ...base, sport_type: "Ride" })).toBeNull();
    expect(mapActivity({ ...base, distance: 0 })).toBeNull();
    expect(mapActivity({ ...base, moving_time: 0 })).toBeNull();
    expect(mapActivity({ ...base, start_date: "nope" })).toBeNull();
  });
  it("copes with missing optional fields and elapsed shorter than moving", () => {
    const r = mapActivity({
      id: 5,
      type: "Run",
      distance: 1000,
      moving_time: 300,
      elapsed_time: 100,
      start_date: "2026-11-10T06:00:00Z",
    })!;
    expect(r).toMatchObject({
      elapsed_seconds: 300,
      elevation_gain_m: null,
      avg_hr: null,
      route: null,
      name: "Run",
    });
  });
});
