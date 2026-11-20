import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "./board-prefs";
import { decideSync, extractBoard, withBoard } from "./board-sync";

describe("board sync helpers", () => {
  it("extracts a valid block and sanitises its prefs", () => {
    const got = extractBoard({
      board: { at: 5, prefs: { size: 99999, theme: "nope", pieces: "celtic" } },
    });
    expect(got?.at).toBe(5);
    expect(got?.prefs.size).toBe(880);
    expect(got?.prefs.theme).toBe(DEFAULT_PREFS.theme);
    expect(got?.prefs.pieces).toBe("celtic");
  });
  it("returns null for missing or malformed blocks", () => {
    expect(extractBoard(null)).toBeNull();
    expect(extractBoard({})).toBeNull();
    expect(extractBoard({ board: "x" })).toBeNull();
    expect(extractBoard({ board: { at: "1", prefs: {} } })).toBeNull();
    expect(extractBoard({ board: { at: 0, prefs: {} } })).toBeNull();
  });
  it("keeps other settings when writing the block", () => {
    const out = withBoard({ theme: "dark", n: 1 }, DEFAULT_PREFS, 9);
    expect(out.theme).toBe("dark");
    expect(out.n).toBe(1);
    expect((out.board as { at: number }).at).toBe(9);
  });
  it("tolerates non-object settings", () => {
    expect(withBoard(null, DEFAULT_PREFS, 1).board).toBeDefined();
    expect(withBoard([1], DEFAULT_PREFS, 1).board).toBeDefined();
  });
  it("decides pull, push or nothing by timestamp", () => {
    expect(decideSync(0, 10)).toBe("pull");
    expect(decideSync(10, 0)).toBe("push");
    expect(decideSync(10, 10)).toBe("none");
    expect(decideSync(0, 0)).toBe("none");
    expect(decideSync(5, 10)).toBe("pull");
  });
});
