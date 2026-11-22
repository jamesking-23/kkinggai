import { describe, expect, it } from "vitest";
import { isInternal, isOpenable } from "./web";

const SITE = "https://kkingg-ai.vercel.app";

describe("website tab link rules", () => {
  it("keeps the site's own pages inside the app", () => {
    expect(isInternal("https://kkingg-ai.vercel.app/tasks", SITE)).toBe(true);
    expect(isInternal("https://kkingg-ai.vercel.app", SITE)).toBe(true);
  });
  it("sends other hosts, look-alikes and plain http outside", () => {
    expect(isInternal("https://example.com", SITE)).toBe(false);
    expect(isInternal("https://kkingg-ai.vercel.app.evil.com/", SITE)).toBe(false);
    expect(isInternal("http://kkingg-ai.vercel.app/", SITE)).toBe(false);
    expect(isInternal("not a url", SITE)).toBe(false);
    expect(isInternal(null, SITE)).toBe(false);
  });
  it("only opens web and mail links outside", () => {
    expect(isOpenable("https://example.com")).toBe(true);
    expect(isOpenable("mailto:a@b.co")).toBe(true);
    for (const bad of [
      "javascript:alert(1)",
      "intent://x#Intent;end",
      "file:///etc/passwd",
      "",
      5,
    ]) {
      expect(isOpenable(bad)).toBe(false);
    }
  });
});
