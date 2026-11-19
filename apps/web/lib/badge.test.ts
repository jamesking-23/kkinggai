import { describe, expect, it } from "vitest";
import { badgeLabel } from "./badge";

describe("badgeLabel", () => {
  it("is empty for zero, negative and invalid counts", () => {
    expect(badgeLabel(0)).toBe("");
    expect(badgeLabel(-3)).toBe("");
    expect(badgeLabel(Number.NaN)).toBe("");
  });
  it("shows the count up to 99 and 99+ beyond", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(99)).toBe("99");
    expect(badgeLabel(100)).toBe("99+");
    expect(badgeLabel(5000)).toBe("99+");
  });
});
