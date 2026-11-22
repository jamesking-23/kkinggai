import { describe, expect, it } from "vitest";
import { extractKinds, sanitizeKinds, withKinds } from "./push-kinds";

const ALL = ["date", "application", "venture_task", "puzzles", "reminder"];

describe("push kinds", () => {
  it("defaults to every kind", () => {
    expect(extractKinds(null)).toEqual(ALL);
    expect(extractKinds({})).toEqual(ALL);
    expect(extractKinds({ push_kinds: "x" })).toEqual(ALL);
  });
  it("reads a saved list, including an empty one", () => {
    expect(extractKinds({ push_kinds: ["reminder", "date"] })).toEqual(["date", "reminder"]);
    expect(extractKinds({ push_kinds: [] })).toEqual([]);
  });
  it("drops unknown and duplicate kinds", () => {
    expect(sanitizeKinds(["date", "date", "evil", 3])).toEqual(["date"]);
    expect(sanitizeKinds("date")).toEqual([]);
  });
  it("stores a subset, removes the key for all, keeps other settings", () => {
    expect(withKinds({ a: 1 }, ["date"])).toEqual({ a: 1, push_kinds: ["date"] });
    expect(withKinds({ a: 1, push_kinds: ["date"] }, ALL)).toEqual({ a: 1 });
    expect(withKinds({}, [])).toEqual({ push_kinds: [] });
  });
});
