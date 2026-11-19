/** Text for a count badge: nothing for zero, "99+" from 100 up. */
export function badgeLabel(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return n > 99 ? "99+" : String(Math.floor(n));
}
