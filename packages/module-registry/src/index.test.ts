import { describe, expect, it } from "vitest";
import { ModuleRegistry } from "./index";

const base = {
  description: "",
  version: "0.1.0",
  nav: { label: "x", href: "/x", icon: "box", order: 1 },
};

describe("ModuleRegistry", () => {
  it("rejects invalid and duplicate modules", () => {
    const r = new ModuleRegistry();
    expect(() => r.register({ ...base, id: "Bad Id", name: "x", status: "active" })).toThrow();
    r.register({ ...base, id: "tasks", name: "Tasks", status: "active" });
    expect(() => r.register({ ...base, id: "tasks", name: "Tasks", status: "active" })).toThrow();
  });

  it("reports unmet dependencies", () => {
    const r = new ModuleRegistry();
    r.register({ ...base, id: "vault", name: "Vault", status: "active" });
    r.register({
      ...base,
      id: "ai",
      name: "AI",
      status: "active",
      dependencies: ["vault"],
    });
    expect(r.unmetDependencies("ai", new Set())).toEqual(["vault"]);
    expect(r.canEnable("ai", new Set(["vault"]))).toBe(true);
  });

  it("builds navigation only from enabled active modules, ordered", () => {
    const r = new ModuleRegistry();
    r.register({ ...base, id: "b", name: "B", status: "active", nav: { ...base.nav, order: 2 } });
    r.register({ ...base, id: "a", name: "A", status: "active", nav: { ...base.nav, order: 1 } });
    r.register({ ...base, id: "p", name: "P", status: "planned" });
    const nav = r.navigation(new Set(["a", "b", "p"]));
    expect(nav.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("blocks disabling core modules and modules others depend on", () => {
    const r = new ModuleRegistry();
    r.register({ ...base, id: "home", name: "Home", status: "active", core: true });
    r.register({ ...base, id: "vault", name: "Vault", status: "active" });
    r.register({ ...base, id: "ai", name: "AI", status: "active", dependencies: ["vault"] });
    const on = new Set(["home", "vault", "ai"]);
    expect(r.disableBlocker("home", on)).toMatch(/core module/);
    expect(r.disableBlocker("vault", on)).toBe("Required by ai");
    expect(r.disableBlocker("vault", new Set(["home", "vault"]))).toBeNull();
    expect(r.disableBlocker("ai", on)).toBeNull();
  });
});
