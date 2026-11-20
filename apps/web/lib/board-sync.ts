// Pure helpers for syncing board preferences through user_settings.settings.board. Safe for client components.
import { sanitizePrefs, type BoardPrefs } from "./board-prefs";

export const PREFS_AT_KEY = "kkingg.board.at";

export type SyncedBoard = { prefs: BoardPrefs; at: number };

/** Reads the saved board block out of a settings object, validating it. Null when absent or malformed. */
export function extractBoard(settings: unknown): SyncedBoard | null {
  if (!settings || typeof settings !== "object") return null;
  const b = (settings as Record<string, unknown>).board;
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  if (typeof o.at !== "number" || !Number.isFinite(o.at) || o.at <= 0) return null;
  return { prefs: sanitizePrefs(o.prefs), at: o.at };
}

/** Returns a copy of settings with the board block replaced; every other key is kept. */
export function withBoard(
  settings: unknown,
  prefs: BoardPrefs,
  at: number,
): Record<string, unknown> {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  return { ...base, board: { prefs: sanitizePrefs(prefs), at } };
}

/** Last write wins. `localAt` is 0 when this browser never customised the board. */
export function decideSync(localAt: number, serverAt: number): "pull" | "push" | "none" {
  if (serverAt > localAt) return "pull";
  if (localAt > serverAt) return "push";
  return "none";
}
