import { describe, expect, it } from "vitest";
import {
  BOARD_MAX,
  BOARD_MIN,
  BOARD_THEMES,
  DEFAULT_PREFS,
  PIECE_SETS,
  parsePrefs,
  pieceCode,
  readableOn,
  sanitizePrefs,
  squareColors,
} from "./board-prefs";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("sanitizePrefs", () => {
  it("returns the defaults for junk", () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs("x")).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({ size: "big", theme: 4, pieces: {} })).toEqual(DEFAULT_PREFS);
  });
  it("clamps and rounds the size", () => {
    expect(sanitizePrefs({ size: 5 }).size).toBe(BOARD_MIN);
    expect(sanitizePrefs({ size: 99999 }).size).toBe(BOARD_MAX);
    expect(sanitizePrefs({ size: 500.6 }).size).toBe(501);
    expect(sanitizePrefs({ size: Number.NaN }).size).toBe(DEFAULT_PREFS.size);
  });
  it("accepts only known themes and piece sets", () => {
    expect(sanitizePrefs({ theme: "ocean" }).theme).toBe("ocean");
    expect(sanitizePrefs({ theme: "custom" }).theme).toBe("custom");
    expect(sanitizePrefs({ theme: "neon" }).theme).toBe(DEFAULT_PREFS.theme);
    expect(sanitizePrefs({ pieces: "glyphs" }).pieces).toBe("glyphs");
    expect(sanitizePrefs({ pieces: "../../etc" }).pieces).toBe(DEFAULT_PREFS.pieces);
  });
  it("accepts only 6-digit hex colours, lower-cased", () => {
    expect(sanitizePrefs({ customLight: "#ABCDEF" }).customLight).toBe("#abcdef");
    expect(sanitizePrefs({ customLight: "red" }).customLight).toBe(DEFAULT_PREFS.customLight);
    expect(sanitizePrefs({ customDark: "#12345" }).customDark).toBe(DEFAULT_PREFS.customDark);
    expect(sanitizePrefs({ customDark: "url(x)" }).customDark).toBe(DEFAULT_PREFS.customDark);
  });
  it("keeps booleans and ignores other types", () => {
    expect(sanitizePrefs({ coordinates: false, hints: false })).toMatchObject({
      coordinates: false,
      hints: false,
    });
    expect(sanitizePrefs({ coordinates: "no" }).coordinates).toBe(true);
  });
});

describe("parsePrefs", () => {
  it("survives missing and broken storage", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("{not json")).toEqual(DEFAULT_PREFS);
  });
  it("round-trips", () => {
    const p = sanitizePrefs({
      size: 700,
      theme: "custom",
      customLight: "#ffffff",
      pieces: "celtic",
    });
    expect(parsePrefs(JSON.stringify(p))).toEqual(p);
  });
});

describe("squareColors, pieceCode, readableOn", () => {
  it("uses the custom colours only for the custom theme", () => {
    const custom = sanitizePrefs({
      theme: "custom",
      customLight: "#111111",
      customDark: "#222222",
    });
    expect(squareColors(custom)).toEqual({ light: "#111111", dark: "#222222" });
    expect(squareColors(sanitizePrefs({ theme: "rose" }))).toMatchObject({ light: "#f3dde0" });
  });
  it("maps glyphs to piece codes", () => {
    expect(pieceCode("♔")).toBe("wK");
    expect(pieceCode("♟")).toBe("bP");
    expect(pieceCode("")).toBeNull();
  });
  it("picks dark text on light squares and light text on dark squares", () => {
    expect(readableOn("#f0e6d2")).toBe("#2a2018");
    expect(readableOn("#3d4766")).toBe("#f6f1e7");
  });
  it("every theme colour is a 6-digit hex", () => {
    for (const t of BOARD_THEMES) expect(`${t.light}${t.dark}`).toMatch(/^(#[0-9a-f]{6}){2}$/);
  });
});

describe("piece files", () => {
  it("every SVG set ships all twelve pieces", () => {
    for (const set of PIECE_SETS.filter((s) => s.id !== "glyphs"))
      for (const code of ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"])
        expect(existsSync(join(__dirname, "../public/pieces", set.id, `${code}.svg`))).toBe(true);
  });
});
