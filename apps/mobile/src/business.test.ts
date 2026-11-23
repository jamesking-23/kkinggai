import { describe, expect, it } from "vitest";
import {
  formatMoney,
  monthLabel,
  monthly,
  parseAmount,
  stageLabel,
  totals,
  type EntryRow,
} from "./business";

const e = (kind: "income" | "expense", amount: number | string, occurred_on: string): EntryRow => ({
  id: `${kind}${amount}${occurred_on}`,
  venture_id: "v",
  kind,
  amount,
  occurred_on,
  category: null,
  description: "",
});

describe("business helpers", () => {
  it("sums in cents without drift", () => {
    expect(totals([e("income", 0.1, "2026-11-01"), e("income", 0.2, "2026-11-02")]).income).toBe(
      0.3,
    );
    expect(totals([e("income", "1500.50", "2026-11-01"), e("expense", 200, "2026-11-02")])).toEqual(
      { income: 1500.5, expense: 200, net: 1300.5 },
    );
    expect(totals([])).toEqual({ income: 0, expense: 0, net: 0 });
  });
  it("groups by month, newest first, limited", () => {
    const m = monthly(
      [
        e("income", 10, "2026-09-05"),
        e("expense", 4, "2026-11-03"),
        e("income", 6, "2026-11-20"),
        e("income", 1, "2026-10-01"),
      ],
      2,
    );
    expect(m.map((x) => x.month)).toEqual(["2026-11", "2026-10"]);
    expect(m[0]).toMatchObject({ income: 6, expense: 4, net: 2 });
  });
  it("formats money with grouping", () => {
    expect(formatMoney(1500, "UGX")).toBe("UGX 1,500");
    expect(formatMoney(1234567.5, "UGX")).toBe("UGX 1,234,567.50");
    expect(formatMoney(-200, "UGX")).toBe("-UGX 200");
    expect(formatMoney(0, "USD")).toBe("USD 0");
    expect(formatMoney(999.99, "USD")).toBe("USD 999.99");
  });
  it("parses typed amounts like the website rules", () => {
    expect(parseAmount("1,500")).toBe(1500);
    expect(parseAmount(" 12.5 ")).toBe(12.5);
    for (const bad of ["", "0", "-5", "1.234", "abc", "1e3", "12.", ".5", "9".repeat(13)])
      expect(parseAmount(bad)).toBeNull();
  });
  it("labels months and stages", () => {
    expect(monthLabel("2026-11")).toBe("Nov 2026");
    expect(monthLabel("bad")).toBe("bad");
    expect(stageLabel("validating")).toBe("Validating");
  });
});
