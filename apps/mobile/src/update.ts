// In-app update check. The Android workflow publishes every build as a GitHub Release tagged "android-<build number>"
// with the APK attached, and bakes the same number into the app (EXPO_PUBLIC_BUILD_NUMBER). Pure helpers, no network here.

export const RELEASES_API =
  "https://api.github.com/repos/jamesking-23/kkinggai/releases?per_page=15";
const DOWNLOAD_PREFIX = "https://github.com/jamesking-23/kkinggai/releases/download/";

export type Release = { build: number; url: string; name: string };

/** "android-42" -> 42; anything else -> null. */
export function parseBuild(tag: unknown): number | null {
  if (typeof tag !== "string") return null;
  const m = /^android-(\d{1,9})$/.exec(tag);
  return m ? Number(m[1]) : null;
}

/** The newest usable Android release from the GitHub API response, or null. Ignores drafts, prereleases and any APK link that is not on this repo's release downloads. */
export function pickLatest(releases: unknown): Release | null {
  if (!Array.isArray(releases)) return null;
  let best: Release | null = null;
  for (const r of releases) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (o.draft === true || o.prerelease === true) continue;
    const build = parseBuild(o.tag_name);
    if (build === null || !Array.isArray(o.assets)) continue;
    for (const a of o.assets) {
      if (!a || typeof a !== "object") continue;
      const asset = a as Record<string, unknown>;
      const url = asset.browser_download_url;
      if (
        typeof asset.name === "string" &&
        asset.name.endsWith(".apk") &&
        typeof url === "string" &&
        url.startsWith(DOWNLOAD_PREFIX)
      ) {
        if (!best || build > best.build) best = { build, url, name: String(o.name ?? o.tag_name) };
        break;
      }
    }
  }
  return best;
}

/** This app's build number from the env text; 0 (a local or development build) when absent or invalid. */
export function currentBuild(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export type UpdateState =
  | { kind: "current"; build: number }
  | { kind: "available"; release: Release }
  | { kind: "unknown" };

/** Decide what to tell the user. A development build (0) is never told it is out of date. */
export function decide(current: number, latest: Release | null): UpdateState {
  if (!latest) return { kind: "unknown" };
  if (current > 0 && latest.build > current) return { kind: "available", release: latest };
  return { kind: "current", build: current };
}
