import { describe, expect, it } from "vitest";
import { formatMoney, monthly, totals } from "./ventures";

describe("totals", () => {
  it("sums income and expense without floating point drift", () => {
    const t = totals([
      { kind: "income", amount: "0.10" },
      { kind: "income", amount: 0.2 },
      { kind: "expense", amount: "0.05" },
    ]);
    expect(t).toEqual({ income: 0.3, expense: 0.05, net: 0.25 });
  });
  it("handles empty input and negative net", () => {
    expect(totals([])).toEqual({ income: 0, expense: 0, net: 0 });
    expect(totals([{ kind: "expense", amount: 5 }]).net).toBe(-5);
  });
});

describe("monthly", () => {
  const rows = [
    { kind: "income", amount: 100, occurred_on: "2026-11-02" },
    { kind: "expense", amount: 40, occurred_on: "2026-11-20" },
    { kind: "expense", amount: 10, occurred_on: "2026-10-05" },
    { kind: "income", amount: 1, occurred_on: "2026-09-05" },
  ];
  it("groups by month, newest first", () => {
    const m = monthly(rows);
    expect(m.map((x) => x.month)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(m[0]).toMatchObject({ income: 100, expense: 40, net: 60 });
  });
  it("respects the limit", () => {
    expect(monthly(rows, 1)).toHaveLength(1);
  });
});

describe("formatMoney", () => {
  it("formats whole and fractional amounts", () => {
    expect(formatMoney(1500000, "UGX")).toBe("UGX 1,500,000");
    expect(formatMoney(1234.5, "USD")).toBe("USD 1,234.50");
    expect(formatMoney(-20, "UGX")).toBe("-UGX 20");
  });
});
