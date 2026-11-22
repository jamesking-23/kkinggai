import { NextResponse } from "next/server";
import { fetchLatestRelease } from "../../../../lib/app-release";

/** Public: sends the phone to the newest APK. The app only ever sees this site's address. */
export async function GET() {
  const latest = await fetchLatestRelease();
  if (!latest) return NextResponse.json({ error: "No build available" }, { status: 404 });
  return NextResponse.redirect(latest.url, 302);
}
