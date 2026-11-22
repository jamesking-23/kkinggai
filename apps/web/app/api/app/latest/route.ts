import { NextResponse } from "next/server";
import { fetchLatestRelease } from "../../../../lib/app-release";

/** Public: which Android build is the newest. The phone app compares this with its own build number. */
export async function GET() {
  const latest = await fetchLatestRelease();
  if (!latest) return NextResponse.json({ build: null }, { status: 200 });
  return NextResponse.json({ build: latest.build, size: latest.size });
}
