import { describe, expect, it } from "vitest";
import { filterModules, greeting, MODULES, visibleModules } from "./modules";

describe("modules", () => {
  it("has unique ids and site-relative paths", () => {
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    for (const m of MODULES) expect(m.path).toBe(`/${m.id}`);
  });
  it("greets by the hour", () => {
    expect(greeting(5)).toBe("Good morning");
    expect(greeting(11)).toBe("Good morning");
    expect(greeting(12)).toBe("Good afternoon");
    expect(greeting(17)).toBe("Good afternoon");
    expect(greeting(18)).toBe("Good evening");
    expect(greeting(2)).toBe("Good evening");
  });
  it("filters by label or hint, case-insensitively", () => {
    expect(filterModules("")).toHaveLength(MODULES.length);
    expect(filterModules("CHE").map((m) => m.id)).toEqual(["chess"]);
    expect(filterModules("deadlines").map((m) => m.id)).toContain("academics");
    expect(filterModules("zzz")).toEqual([]);
  });
});

describe("visibleModules", () => {
  it("hides only modules that are switched off", () => {
    const out = visibleModules(MODULES, new Set(["chess", "news"]));
    expect(out.some((m) => m.id === "chess")).toBe(false);
    expect(out.some((m) => m.id === "news")).toBe(false);
    expect(out.length).toBe(MODULES.length - 2);
    expect(visibleModules(MODULES, new Set()).length).toBe(MODULES.length);
  });
});
