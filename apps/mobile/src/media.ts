// Entertainment helpers (books, films, shows, games, music, podcasts), mirroring the website's rules. Pure.
// Kinds and statuses are repeated from packages/schemas; keep them in sync.

export const MEDIA_KINDS = ["book", "movie", "show", "game", "music", "podcast", "other"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export const MEDIA_STATUSES = ["wishlist", "in_progress", "done", "dropped"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export type MediaRow = {
  id: string;
  kind: MediaKind;
  title: string;
  creator: string | null;
  status: MediaStatus;
  rating: number | null;
  finished_on: string | null;
  notes: string;
  revision: number;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const kindLabel = (k: MediaKind) => cap(k === "movie" ? "film" : k);
export const statusLabel = (s: MediaStatus) => cap(s.replace(/_/g, " "));

export function statusCounts(items: readonly MediaRow[]): { status: MediaStatus; count: number }[] {
  return MEDIA_STATUSES.map((status) => ({
    status,
    count: items.filter((i) => i.status === status).length,
  }));
}

export function filterMedia(
  items: readonly MediaRow[],
  status: MediaStatus | "all",
  kind: MediaKind | "all",
  query: string,
): MediaRow[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (status === "all" || i.status === status) &&
      (kind === "all" || i.kind === kind) &&
      (!q || i.title.toLowerCase().includes(q) || (i.creator ?? "").toLowerCase().includes(q)),
  );
}

/** Title and creator for a new item, or an error message. Limits match the website (200 and 160). */
export function checkMedia(
  title: string,
  creator: string,
): { title: string; creator: string | null } | string {
  const t = title.trim();
  if (!t) return "Enter a title.";
  if (t.length > 200) return "The title is too long (200 characters at most).";
  const c = creator.trim();
  if (c.length > 160) return "The creator is too long (160 characters at most).";
  return { title: t, creator: c || null };
}

/** The update for moving an item to a status. Finishing stamps `today` unless a finish date exists; a rating is optional (1 to 5). */
export function statusPatch(
  item: Pick<MediaRow, "finished_on">,
  status: MediaStatus,
  rating: number | null,
  today: string,
): { status: MediaStatus; rating?: number; finished_on?: string } {
  const p: { status: MediaStatus; rating?: number; finished_on?: string } = { status };
  if (rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 5) p.rating = rating;
  if (status === "done" && !item.finished_on) p.finished_on = today;
  return p;
}

export const stars = (r: number | null) => (r ? "★".repeat(r) + "☆".repeat(5 - r) : "");
