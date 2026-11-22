// The website tab: which addresses may load inside the app. Everything else opens in the phone's browser.
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://kkingg-ai.vercel.app";

/** True when the address is on the site's own origin (https, same host), so it may load inside the app. */
export function isInternal(url: unknown, site: string = SITE_URL): boolean {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    const s = new URL(site);
    return u.protocol === "https:" && u.host === s.host;
  } catch {
    return false;
  }
}

/** True for http(s) and mailto links that are safe to hand to the phone. Blocks intent:, file:, javascript: and the like. */
export function isOpenable(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}
