import { describe, expect, it } from "vitest";
import { PIECE_SETS } from "./chessPieceSets";
import {
  BOARD_THEMES,
  DEFAULT_BOARD_PREFS,
  PIECE_SET_LIST,
  pieceCode,
  sanitizeBoardPrefs,
  themeFor,
} from "./boardPrefs";

describe("board prefs", () => {
  it("falls back to defaults per field", () => {
    expect(sanitizeBoardPrefs(null)).toEqual(DEFAULT_BOARD_PREFS);
    expect(sanitizeBoardPrefs({ theme: "nope", pieces: "x", coordinates: "y" })).toEqual(
      DEFAULT_BOARD_PREFS,
    );
    expect(sanitizeBoardPrefs({ theme: "green", pieces: "totoy", coordinates: false })).toEqual({
      theme: "green",
      pieces: "totoy",
      coordinates: false,
    });
  });

  it("maps FEN letters to piece codes and unknown themes to the first", () => {
    expect(pieceCode("N")).toBe("wN");
    expect(pieceCode("q")).toBe("bQ");
    expect(themeFor("zzz")).toBe(BOARD_THEMES[0]);
  });

  it("has all 12 pieces, as valid SVG, in every listed set", () => {
    for (const { id } of PIECE_SET_LIST) {
      const set = PIECE_SETS[id]!;
      expect(Object.keys(set)).toHaveLength(12);
      for (const svg of Object.values(set)) {
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        expect(svg).toContain("viewBox");
      }
    }
  });
});
