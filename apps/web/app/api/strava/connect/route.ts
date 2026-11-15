import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "../../../../lib/strava";
import { createClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

/** Starts the Strava sign-in. The random state is kept in a short-lived httpOnly cookie and checked on return. */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId || !process.env.STRAVA_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${origin}/running?error=${encodeURIComponent("Strava is not configured on the server")}`,
    );
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(
    authorizeUrl({ clientId, redirectUri: `${origin}/api/strava/callback`, state }),
  );
  res.cookies.set("strava_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/strava",
  });
  return res;
}
