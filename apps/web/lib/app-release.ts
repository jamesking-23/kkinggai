// Latest Android build, read from this repository's GitHub Releases on the server so the phone app only ever talks to this site.
// The workflow publishes each build as a release tagged "android-<number>" with kkingg-ai.apk attached.

const RELEASES_API = "https://api.github.com/repos/jamesking-23/kkinggai/releases?per_page=15";
const DOWNLOAD_PREFIX = "https://github.com/jamesking-23/kkinggai/releases/download/";

export type AppRelease = { build: number; url: string; size: number };

export function parseBuild(tag: unknown): number | null {
  if (typeof tag !== "string") return null;
  const m = /^android-(\d{1,9})$/.exec(tag);
  return m ? Number(m[1]) : null;
}

/** Newest usable release: not a draft or prerelease, tagged android-<n>, with an .apk under this repository's release downloads. */
export function pickLatest(releases: unknown): AppRelease | null {
  if (!Array.isArray(releases)) return null;
  let best: AppRelease | null = null;
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
        const size = typeof asset.size === "number" && asset.size > 0 ? asset.size : 0;
        if (!best || build > best.build) best = { build, url, size };
        break;
      }
    }
  }
  return best;
}

/** Fetches the release list (cached five minutes) and returns the newest build, or null when none or GitHub is unreachable. */
export async function fetchLatestRelease(): Promise<AppRelease | null> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return pickLatest(await res.json());
  } catch {
    return null;
  }
}
