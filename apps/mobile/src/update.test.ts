import { describe, expect, it } from "vitest";
import { currentBuild, decide, parseLatest, percent, sizeLabel } from "./update";

describe("update helpers", () => {
  it("reads the current build", () => {
    expect(currentBuild("12")).toBe(12);
    for (const bad of [undefined, "", "abc", "-3", "1.5", "0"]) expect(currentBuild(bad)).toBe(0);
  });
  it("parses the site's answer", () => {
    expect(parseLatest({ build: 9, size: 68_000_000 })).toEqual({ build: 9, size: 68_000_000 });
    expect(parseLatest({ build: 9 })).toEqual({ build: 9, size: 0 });
    for (const bad of [
      null,
      {},
      { build: null },
      { build: 0 },
      { build: 1.5 },
      { build: "9" },
      "x",
    ]) {
      expect(parseLatest(bad)).toBeNull();
    }
  });
  it("decides what to show", () => {
    const latest = { build: 10, size: 5 };
    expect(decide(7, latest)).toEqual({ kind: "available", build: 10, size: 5 });
    expect(decide(10, latest)).toEqual({ kind: "current", build: 10 });
    expect(decide(12, latest).kind).toBe("current");
    expect(decide(0, latest).kind).toBe("current"); // development build
    expect(decide(7, null)).toEqual({ kind: "unknown" });
  });
  it("formats size and progress", () => {
    expect(sizeLabel(68_331_281)).toBe("68 MB");
    expect(sizeLabel(10)).toBe("1 MB");
    expect(sizeLabel(0)).toBe("");
    expect(percent(50, 200)).toBe(25);
    expect(percent(300, 200)).toBe(100);
    expect(percent(5, 0)).toBe(0);
    expect(percent(-1, 10)).toBe(0);
  });
});
