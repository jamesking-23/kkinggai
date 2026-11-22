// In-app update. The phone only talks to the KKINGG AI site: /api/app/latest says which build is newest and
// /api/app/download sends the file. Pure helpers here, no network or native calls.
import { SITE_URL } from "./web";

export const LATEST_URL = `${SITE_URL}/api/app/latest`;
export const DOWNLOAD_URL = `${SITE_URL}/api/app/download`;

/** This app's build number from the env text; 0 (a local or development build) when absent or invalid. */
export function currentBuild(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** The newest build number from the site's answer, or null when none is published or the answer is malformed. */
export function parseLatest(json: unknown): { build: number; size: number } | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.build !== "number" || !Number.isInteger(o.build) || o.build <= 0) return null;
  const size = typeof o.size === "number" && o.size > 0 ? o.size : 0;
  return { build: o.build, size };
}

export type UpdateState =
  | { kind: "current"; build: number }
  | { kind: "available"; build: number; size: number }
  | { kind: "unknown" };

/** A development build (0) is never told it is out of date. */
export function decide(
  current: number,
  latest: { build: number; size: number } | null,
): UpdateState {
  if (!latest) return { kind: "unknown" };
  if (current > 0 && latest.build > current) return { kind: "available", ...latest };
  return { kind: "current", build: current };
}

/** "42 MB" style size, "" when unknown. */
export function sizeLabel(bytes: number): string {
  if (!(bytes > 0)) return "";
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}

/** Whole percent 0-100 for a download, clamped; 0 when the total is unknown. */
export function percent(written: number, total: number): number {
  if (!(total > 0) || !(written >= 0)) return 0;
  return Math.min(100, Math.floor((written / total) * 100));
}
