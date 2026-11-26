// Board look for the phone: colour theme, piece set, coordinates. Pure; storage lives in boardPrefsStore.ts.

export type BoardTheme = { id: string; name: string; light: string; dark: string; hot: string };

export const BOARD_THEMES: readonly BoardTheme[] = [
  { id: "walnut", name: "Walnut", light: "#f0d9b5", dark: "#b58863", hot: "#f2d36b" },
  { id: "green", name: "Tournament", light: "#eeeed2", dark: "#769656", hot: "#f6f669" },
  { id: "blue", name: "Ocean", light: "#dee3e6", dark: "#8ca2ad", hot: "#f2e06b" },
  { id: "slate", name: "Slate", light: "#c9ccd6", dark: "#5a6177", hot: "#e7c75e" },
  { id: "rose", name: "Rosewood", light: "#ecd7d0", dark: "#a8706b", hot: "#f0d26a" },
] as const;

export const PIECE_SET_LIST: readonly { id: string; name: string }[] = [
  { id: "classic", name: "Classic" },
  { id: "chessnut", name: "Chessnut" },
  { id: "spatial", name: "Spatial" },
  { id: "totoy", name: "Totoy" },
] as const;

export type BoardPrefs = { theme: string; pieces: string; coordinates: boolean };

export const DEFAULT_BOARD_PREFS: BoardPrefs = {
  theme: "walnut",
  pieces: "classic",
  coordinates: true,
};

export const BOARD_PREFS_KEY = "kkingg.board.v1";

/** Turns whatever is in storage into valid preferences, falling back to the default per field. */
export function sanitizeBoardPrefs(input: unknown): BoardPrefs {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_BOARD_PREFS;
  return {
    theme: BOARD_THEMES.some((t) => t.id === o.theme) ? (o.theme as string) : d.theme,
    pieces: PIECE_SET_LIST.some((p) => p.id === o.pieces) ? (o.pieces as string) : d.pieces,
    coordinates: typeof o.coordinates === "boolean" ? o.coordinates : d.coordinates,
  };
}

export function themeFor(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0]!;
}

/** Piece code such as "wN" for a FEN piece letter ("N" is a white knight, "n" a black one). */
export function pieceCode(letter: string): string {
  return `${letter === letter.toUpperCase() ? "w" : "b"}${letter.toUpperCase()}`;
}
