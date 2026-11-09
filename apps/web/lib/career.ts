import { APPLICATION_STATUSES } from "@kkingg/schemas";

export type ApplicationLite = { status: string; deadline: string | null };
export type CvEntryLite = {
  kind: string;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
};

/** Counts applications per status, in pipeline order, including zero counts. */
export function pipelineCounts(apps: ApplicationLite[]): { status: string; count: number }[] {
  return APPLICATION_STATUSES.map((status) => ({
    status,
    count: apps.filter((a) => a.status === status).length,
  }));
}

/** Open applications (not rejected, withdrawn or offered) whose deadline is within `days` days of `today` (YYYY-MM-DD). */
export function dueSoon<T extends ApplicationLite>(apps: T[], today: string, days = 14): T[] {
  const limit = new Date(`${today}T00:00:00Z`).getTime() + days * 86_400_000;
  return apps
    .filter((a) => a.deadline && ["wishlist", "applied", "interviewing"].includes(a.status))
    .filter((a) => {
      const t = new Date(`${a.deadline}T00:00:00Z`).getTime();
      return t >= new Date(`${today}T00:00:00Z`).getTime() && t <= limit;
    })
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthYear(d: string): string {
  const [y, m] = d.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "Jan 2023 – Present", "Jan 2023 – Jun 2024", "Jan 2023", or "" when there is no start date. */
export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (!start) return monthYear(end!);
  return end ? `${monthYear(start)} – ${monthYear(end)}` : `${monthYear(start)} – Present`;
}

/** Most recent first (no start date last), then explicit sort order. */
export function sortEntries<T extends CvEntryLite>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    if (a.start_date && b.start_date) return b.start_date.localeCompare(a.start_date);
    if (a.start_date) return -1;
    if (b.start_date) return 1;
    return 0;
  });
}
