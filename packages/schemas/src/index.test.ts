import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./index";

describe("auth schemas", () => {
  it("normalises email on login", () => {
    const r = loginSchema.parse({ email: "  A@Example.COM ", password: "x" });
    expect(r.email).toBe("a@example.com");
  });

  it("rejects weak registration passwords", () => {
    const base = { displayName: "Ann", email: "a@b.co" };
    expect(registerSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "onlyletterslong" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "longenough123" }).success).toBe(true);
  });

  it("requires matching passwords on reset", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "longenough123", confirm: "nope" }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ password: "longenough123", confirm: "longenough123" })
        .success,
    ).toBe(true);
  });

  it("validates profile name and time zone", async () => {
    const { profileSchema } = await import("./index");
    expect(
      profileSchema.safeParse({ displayName: "Ann", timezone: "Africa/Kampala" }).success,
    ).toBe(true);
    expect(profileSchema.safeParse({ displayName: " ", timezone: "UTC" }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "Ann", timezone: "Mars/Base" }).success).toBe(
      false,
    );
  });

  it("rejects invalid email for forgot password", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
