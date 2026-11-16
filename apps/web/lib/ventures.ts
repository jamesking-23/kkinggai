export type Entry = { kind: string; amount: number | string; occurred_on: string };
export type Totals = { income: number; expense: number; net: number };

/** Works in whole minor units (cents) so repeated sums do not drift. */
const cents = (v: number | string) => Math.round(Number(v) * 100);

export function totals(entries: Pick<Entry, "kind" | "amount">[]): Totals {
  let inc = 0;
  let exp = 0;
  for (const e of entries) {
    if (e.kind === "income") inc += cents(e.amount);
    else if (e.kind === "expense") exp += cents(e.amount);
  }
  return { income: inc / 100, expense: exp / 100, net: (inc - exp) / 100 };
}

/** Totals for each calendar month (YYYY-MM), newest first, limited to `limit` months. */
export function monthly(entries: Entry[], limit = 6): ({ month: string } & Totals)[] {
  const by = new Map<string, Entry[]>();
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

export function formatMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const whole = Number.isInteger(abs);
  const text = abs.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${currency} ${text}`;
}
