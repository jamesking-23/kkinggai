// Pure helpers for the chess board look. Safe to import from client components.

export const BOARD_MIN = 280;
export const BOARD_MAX = 880;
export const BOARD_DEFAULT = 460;

export type BoardTheme = { id: string; name: string; light: string; dark: string };

/** Light and dark square colours. "custom" takes its colours from the saved preferences instead. */
export const BOARD_THEMES: readonly BoardTheme[] = [
  { id: "walnut", name: "Walnut", light: "#ecd9b7", dark: "#a47a52" },
  { id: "emerald", name: "Emerald", light: "#eeeed2", dark: "#6a9b50" },
  { id: "ocean", name: "Ocean", light: "#dce6ee", dark: "#6b8fb0" },
  { id: "slate", name: "Slate", light: "#c9ced6", dark: "#6c7685" },
  { id: "midnight", name: "Midnight", light: "#8f9bb8", dark: "#3d4766" },
  { id: "rose", name: "Rose", light: "#f3dde0", dark: "#c0828e" },
  { id: "sand", name: "Sand", light: "#f0e6d2", dark: "#c3a77a" },
  { id: "amethyst", name: "Amethyst", light: "#e2dcf2", dark: "#8272b8" },
];

export type PieceSet = { id: string; name: string; credit: string };

/** "glyphs" are Unicode characters drawn by the browser; the rest are SVG files in /public/pieces. */
export const PIECE_SETS: readonly PieceSet[] = [
  { id: "chessnut", name: "Chessnut", credit: "Alexis Luengas, Apache 2.0" },
  { id: "celtic", name: "Celtic", credit: "Maurizio Monge, MIT" },
  { id: "fantasy", name: "Fantasy", credit: "Maurizio Monge, MIT" },
  { id: "spatial", name: "Spatial", credit: "Maurizio Monge, MIT" },
  { id: "rhosgfx", name: "Rhos", credit: "RhosGFX, CC0" },
  { id: "papercut", name: "Papercut", credit: "Nikolay Anzarov, CC BY 4.0" },
  { id: "totoy", name: "Totoy", credit: "Kosal Sen, CC BY 4.0" },
  { id: "kiwen-suwi", name: "Kiwen Suwi", credit: "neverRare, CC BY 4.0" },
  { id: "glyphs", name: "Plain glyphs", credit: "Unicode characters" },
];

export type BoardPrefs = {
  size: number;
  theme: string;
  customLight: string;
  customDark: string;
  pieces: string;
  coordinates: boolean;
  hints: boolean;
};

export const DEFAULT_PREFS: BoardPrefs = {
  size: BOARD_DEFAULT,
  theme: "walnut",
  customLight: "#e9e4d8",
  customDark: "#7a8c6e",
  pieces: "chessnut",
  coordinates: true,
  hints: true,
};

export const PREFS_KEY = "kkingg.board.v1";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Turns whatever is in storage into valid preferences, falling back to the default per field. */
export function sanitizePrefs(input: unknown): BoardPrefs {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFS;
  const size =
    typeof o.size === "number" && Number.isFinite(o.size)
      ? Math.min(BOARD_MAX, Math.max(BOARD_MIN, Math.round(o.size)))
      : d.size;
  const theme =
    typeof o.theme === "string" &&
    (o.theme === "custom" || BOARD_THEMES.some((t) => t.id === o.theme))
      ? o.theme
      : d.theme;
  const pieces =
    typeof o.pieces === "string" && PIECE_SETS.some((p) => p.id === o.pieces) ? o.pieces : d.pieces;
  const hex = (v: unknown, fallback: string) =>
    typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback;
  return {
    size,
    theme,
    customLight: hex(o.customLight, d.customLight),
    customDark: hex(o.customDark, d.customDark),
    pieces,
    coordinates: typeof o.coordinates === "boolean" ? o.coordinates : d.coordinates,
    hints: typeof o.hints === "boolean" ? o.hints : d.hints,
  };
}

export function parsePrefs(raw: string | null): BoardPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    return sanitizePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFS;
  }
}

/** The two square colours for the chosen theme. */
export function squareColors(p: BoardPrefs): { light: string; dark: string } {
  if (p.theme === "custom") return { light: p.customLight, dark: p.customDark };
  const t = BOARD_THEMES.find((x) => x.id === p.theme) ?? BOARD_THEMES[0]!;
  return { light: t.light, dark: t.dark };
}

const GLYPH_CODES: Record<string, string> = {
  "♔": "wK",
  "♕": "wQ",
  "♖": "wR",
  "♗": "wB",
  "♘": "wN",
  "♙": "wP",
  "♚": "bK",
  "♛": "bQ",
  "♜": "bR",
  "♝": "bB",
  "♞": "bN",
  "♟": "bP",
};

/** "wK", "bP", ... for a piece glyph; null for an empty square. */
export function pieceCode(glyph: string): string | null {
  return GLYPH_CODES[glyph] ?? null;
}

/** "#rrggbb" -> relative luminance 0..1, used to pick a readable coordinate colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** Dark text on light squares and the reverse, whichever the colour needs. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.35 ? "#2a2018" : "#f6f1e7";
}
