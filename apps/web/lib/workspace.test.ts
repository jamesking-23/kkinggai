import { describe, expect, it } from "vitest";
import { resolveWorkspace } from "./workspace";

const a = { id: "a", name: "Personal", kind: "personal" };
const b = { id: "b", name: "Biz", kind: "business" };

describe("resolveWorkspace", () => {
  it("honours a valid preference", () => {
    expect(resolveWorkspace([a, b], "b")).toBe(b);
  });

  it("ignores a preference the user cannot access", () => {
    expect(resolveWorkspace([a, b], "someone-elses")).toBe(a);
    expect(resolveWorkspace([a], undefined)).toBe(a);
  });

  it("returns null when there are no workspaces", () => {
    expect(resolveWorkspace([], "a")).toBeNull();
  });
});
