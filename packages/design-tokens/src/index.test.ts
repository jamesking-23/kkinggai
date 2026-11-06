import { describe, expect, it } from "vitest";
import { colors } from "./index";

describe("design tokens", () => {
  it("defines every color as a 6-digit hex", () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
