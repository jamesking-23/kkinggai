import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps relative paths", () => {
    expect(safeNext("/reset-password")).toBe("/reset-password");
  });

  it("falls back to / for missing or unsafe targets", () => {
    for (const bad of [null, "", "https://evil.com", "//evil.com", "/\\evil.com", "evil"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});
