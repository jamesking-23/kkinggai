import { describe, expect, it } from "vitest";
import {
  canManageRole,
  checkProfile,
  isValidZone,
  moduleViews,
  type RegistryModule,
} from "./settings";

const mod = (id: string, core = false): RegistryModule => ({
  id,
  name: id,
  description: "",
  core,
  dependencies: [],
  status: "stable",
});

describe("settings", () => {
  it("validates time zones", () => {
    expect(isValidZone("Africa/Kampala")).toBe(true);
    expect(isValidZone("UTC")).toBe(true);
    expect(isValidZone("Mars/Base")).toBe(false);
    expect(isValidZone(" ")).toBe(false);
  });

  it("validates the profile", () => {
    expect(checkProfile(" Ezra ", " Africa/Kampala ")).toEqual({
      displayName: "Ezra",
      timezone: "Africa/Kampala",
    });
    expect(checkProfile(" ", "UTC")).toBe("Enter your name.");
    expect(checkProfile("x".repeat(81), "UTC")).toMatch(/80/);
    expect(checkProfile("A", "Nope/Zone")).toMatch(/valid time zone/);
    expect(checkProfile("A", "anything", () => true)).toEqual({
      displayName: "A",
      timezone: "anything",
    });
  });

  it("works out which modules can be toggled", () => {
    const reg = [mod("tasks", true), mod("chess"), mod("news")];
    const state = new Map([
      ["tasks", true],
      ["chess", false],
    ]);
    const v = moduleViews(reg, state, true);
    expect(v.map((m) => [m.id, m.available, m.enabled, m.canToggle])).toEqual([
      ["tasks", true, true, false],
      ["chess", true, false, true],
      ["news", false, false, false],
    ]);
    expect(moduleViews(reg, state, false).some((m) => m.canToggle)).toBe(false);
  });

  it("knows who can manage", () => {
    expect(canManageRole("owner")).toBe(true);
    expect(canManageRole("admin")).toBe(true);
    expect(canManageRole("member")).toBe(false);
    expect(canManageRole(null)).toBe(false);
  });
});
