// Venture money helpers, mirroring apps/web/lib/ventures.ts and the entry rules in packages/schemas. Pure.
// Works in whole cents so repeated sums do not drift. Stages are repeated from the shared schemas; keep them in sync.

export const VENTURE_STAGES = [
  "idea",
  "validating",
  "building",
  "launched",
  "paused",
  "closed",
] as const;
export type VentureStage = (typeof VENTURE_STAGES)[number];

export type VentureRow = { id: string; name: string; stage: VentureStage; currency: string };
export type EntryRow = {
  id: string;
  venture_id: string;
  kind: "income" | "expense";
  amount: number | string;
  occurred_on: string;
  category: string | null;
  description: string;
};
export type Totals = { income: number; expense: number; net: number };

const cents = (v: number | string) => Math.round(Number(v) * 100);

export function totals(entries: readonly Pick<EntryRow, "kind" | "amount">[]): Totals {
  let inc = 0;
  let exp = 0;
  for (const e of entries) {
    if (e.kind === "income") inc += cents(e.amount);
    else if (e.kind === "expense") exp += cents(e.amount);
  }
  return { income: inc / 100, expense: exp / 100, net: (inc - exp) / 100 };
}

/** Totals per calendar month (YYYY-MM), newest first, at most `limit` months. */
export function monthly(entries: readonly EntryRow[], limit = 3): ({ month: string } & Totals)[] {
  const by = new Map<string, EntryRow[]>();
  for (const e of entries) {
    const m = e.occurred_on.slice(0, 7);
    by.set(m, [...(by.get(m) ?? []), e]);
  }
  return [...by.keys()]
    .sort()
    .reverse()
    .slice(0, limit)
    .map((month) => ({ month, ...totals(by.get(month)!) }));
}

/** "UGX 1,500" / "UGX 1,500.50" / "-UGX 200". Grouping is done by hand so it does not depend on the phone's Intl support. */
export function formatMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? "-" : "";
  const c = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(c / 100);
  const frac = c % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${currency} ${grouped}${frac ? `.${String(frac).padStart(2, "0")}` : ""}`;
}

/** An amount typed on the phone: commas allowed as thousands separators, more than 0, under 1e12, at most two decimals. Null otherwise. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n < 999_999_999_999 ? n : null;
}

/** "Nov 2026" from "2026-11". */
export function monthLabel(month: string): string {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [y, m] = month.split("-");
  const name = names[Number(m) - 1];
  return name && y ? `${name} ${y}` : month;
}

export function stageLabel(s: VentureStage): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
