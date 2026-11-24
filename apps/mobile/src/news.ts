// News helpers, mirroring the website's news page. Pure.

export type FeedRow = { id: string; title: string | null; url: string; last_error: string | null };
export type NewsItem = {
  id: string;
  feed_id: string;
  title: string;
  link: string | null;
  summary: string | null;
  published_at: string | null;
  read_at: string | null;
  saved: boolean;
};

export type NewsFilter = "unread" | "all" | "saved";

/** Only web links open from the phone (never javascript:, file: or other schemes). */
export function safeLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const u = new URL(link.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Display name of a feed: its title, else its host, else the raw URL. */
export function feedName(f: Pick<FeedRow, "title" | "url">): string {
  if (f.title?.trim()) return f.title.trim();
  try {
    return new URL(f.url).host;
  } catch {
    return f.url;
  }
}

export function filterItems(
  items: readonly NewsItem[],
  filter: NewsFilter,
  feedId: string | null,
): NewsItem[] {
  return items.filter(
    (i) =>
      (!feedId || i.feed_id === feedId) &&
      (filter === "all" || (filter === "unread" ? !i.read_at : i.saved)),
  );
}

export function unreadByFeed(items: readonly NewsItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) if (!i.read_at) m.set(i.feed_id, (m.get(i.feed_id) ?? 0) + 1);
  return m;
}

/** Short date such as "24 Nov", or "" when missing or invalid. */
export function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]}`;
}

/** Feed summaries often contain HTML: strip tags and common entities, collapse spaces, cap the length. */
export function plainSummary(html: string | null, max = 240): string {
  if (!html) return "";
  const t = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
