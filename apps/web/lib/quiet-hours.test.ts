import { describe, expect, it } from "vitest";
import { extractQuiet, isValidTime, withQuiet } from "./quiet-hours";

describe("quiet hours helpers", () => {
  it("validates HH:MM", () => {
    for (const ok of ["00:00", "07:30", "23:59"]) expect(isValidTime(ok)).toBe(true);
    for (const bad of ["24:00", "7:30", "12:60", "", "ab:cd", 730, null])
      expect(isValidTime(bad)).toBe(false);
  });
  it("extracts a valid window and rejects the rest", () => {
    expect(extractQuiet({ push_quiet: { from: "22:00", to: "07:00" } })).toEqual({
      from: "22:00",
      to: "07:00",
    });
    expect(extractQuiet({ push_quiet: { from: "10:00", to: "10:00" } })).toBeNull();
    expect(extractQuiet({ push_quiet: { from: "25:00", to: "07:00" } })).toBeNull();
    expect(extractQuiet({ push_quiet: "x" })).toBeNull();
    expect(extractQuiet(null)).toBeNull();
    expect(extractQuiet({})).toBeNull();
  });
  it("sets and clears the window while keeping other settings", () => {
    const set = withQuiet({ board: { at: 1 } }, { from: "22:00", to: "07:00" });
    expect(set).toEqual({ board: { at: 1 }, push_quiet: { from: "22:00", to: "07:00" } });
    expect(withQuiet(set, null)).toEqual({ board: { at: 1 } });
    expect(withQuiet(undefined, null)).toEqual({});
  });
  it("does not mutate its input", () => {
    const s = { push_quiet: { from: "22:00", to: "07:00" } };
    withQuiet(s, null);
    expect(s.push_quiet).toBeDefined();
  });
});
