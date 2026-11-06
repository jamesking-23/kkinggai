import { describe, expect, it } from "vitest";
import { isPublicPath } from "./middleware";

describe("isPublicPath", () => {
  it("allows auth pages and callbacks", () => {
    for (const p of [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
    ]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("protects everything else, including lookalike prefixes", () => {
    for (const p of ["/", "/tasks", "/login-admin", "/authx"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
