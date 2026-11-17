/** Short relative time such as "5 min ago", "3 h ago", "2 d ago", or the date for anything older than a week. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(t).toISOString().slice(0, 10);
}

/** "Overdue", "Due today", "Due tomorrow" or "Due 2026-11-20", comparing calendar days in UTC. */
export function dueLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const day = (ms: number) => Math.floor(ms / 86_400_000);
  const diff = day(t) - day(now.getTime());
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due ${new Date(t).toISOString().slice(0, 10)}`;
}

/** Notification links are web paths; only plain paths are ever shown. */
export const isSafeLink = (l: string | null): l is string => !!l && /^\/[A-Za-z0-9/_-]*$/.test(l);
