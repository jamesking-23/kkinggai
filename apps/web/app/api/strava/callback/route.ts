import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, StravaError } from "../../../../lib/strava";
import { createClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function done(origin: string, kind: "error" | "message", text: string) {
  const res = NextResponse.redirect(`${origin}/running?${kind}=${encodeURIComponent(text)}`);
  res.cookies.set("strava_state", "", { path: "/api/strava", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const expected = request.cookies.get("strava_state")?.value;
  const state = searchParams.get("state");
  if (!expected || !state || expected !== state)
    return done(origin, "error", "The Strava sign-in could not be verified. Try again.");
  if (searchParams.get("error")) return done(origin, "error", "Strava access was not granted.");

  const code = searchParams.get("code");
  const scope = searchParams.get("scope") ?? "";
  if (!code) return done(origin, "error", "Strava did not return a sign-in code.");
  if (!scope.includes("activity:read"))
    return done(origin, "error", "Strava needs permission to read your activities.");

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return done(origin, "error", "Strava is not configured on the server");

  try {
    const t = await exchangeCode(fetch, { clientId, clientSecret, code });
    if (t.athleteId === null) return done(origin, "error", "Strava did not identify the account.");
    const { error } = await supabase.from("strava_connections").upsert({
      user_id: user.id,
      athlete_id: t.athleteId,
      access_token: t.accessToken,
      refresh_token: t.refreshToken,
      expires_at: t.expiresAt.toISOString(),
      scope: scope.slice(0, 200),
    });
    if (error) return done(origin, "error", "Could not save the Strava connection.");
  } catch (e) {
    return done(
      origin,
      "error",
      e instanceof StravaError ? e.message : "Strava connection failed.",
    );
  }
  return done(origin, "message", "Strava connected. Press Sync Strava to import your runs.");
}
