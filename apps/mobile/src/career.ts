// Job application helpers, mirroring the website (apps/web/lib/career.ts and the status list in packages/schemas). Pure.
// The status list is repeated here because the phone app does not depend on the shared schemas package; keep it in sync.

export const APPLICATION_STATUSES = [
  "wishlist",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  location: string | null;
  applied_on: string | null;
  deadline: string | null;
  revision: number;
};

export function isStatus(v: unknown): v is ApplicationStatus {
  return typeof v === "string" && (APPLICATION_STATUSES as readonly string[]).includes(v);
}

export function statusLabel(s: ApplicationStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Counts per status in pipeline order, including zeros. */
export function pipelineCounts(
  apps: readonly { status: string }[],
): { status: ApplicationStatus; count: number }[] {
  return APPLICATION_STATUSES.map((status) => ({
    status,
    count: apps.filter((a) => a.status === status).length,
  }));
}

/** Open applications (wishlist, applied, interviewing) with a deadline from today up to `days` days ahead, soonest first. */
export function dueSoon<T extends { status: string; deadline: string | null }>(
  apps: readonly T[],
  today: string,
  days = 14,
): T[] {
  const start = Date.parse(`${today}T00:00:00Z`);
  const limit = start + days * 86_400_000;
  return apps
    .filter((a) => a.deadline && ["wishlist", "applied", "interviewing"].includes(a.status))
    .filter((a) => {
      const t = Date.parse(`${a.deadline!.slice(0, 10)}T00:00:00Z`);
      return Number.isFinite(t) && t >= start && t <= limit;
    })
    .sort((a, b) => a.deadline!.slice(0, 10).localeCompare(b.deadline!.slice(0, 10)));
}

/** The update for moving to a status. Moving to "applied" with no date recorded stamps today, as the website does. */
export function statusPatch(
  status: ApplicationStatus,
  hasAppliedOn: boolean,
  today: string,
): { status: ApplicationStatus; applied_on?: string } {
  return status === "applied" && !hasAppliedOn ? { status, applied_on: today } : { status };
}

/** Trimmed single-line text capped at `max`, or null when empty. */
export function cleanLine(raw: string, max = 200): string | null {
  const t = raw.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
}

/** Filter by status ("all" keeps everything) and a text query on company or role. */
export function filterApplications<T extends { status: string; company: string; role: string }>(
  apps: readonly T[],
  status: ApplicationStatus | "all",
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return apps.filter(
    (a) =>
      (status === "all" || a.status === status) &&
      (!q || a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)),
  );
}
