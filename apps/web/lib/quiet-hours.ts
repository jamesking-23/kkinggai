// Push quiet hours, stored in user_settings.settings.push_quiet = {from:"HH:MM", to:"HH:MM"}. Safe for client components.
// The database function push_in_quiet() applies the same rules when deciding whether to push.

export type QuietHours = { from: string; to: string };

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isValidTime(v: unknown): v is string {
  return typeof v === "string" && TIME.test(v);
}

/** Reads the saved window out of a settings object. Null when absent, malformed, or from equals to (no quiet hours). */
export function extractQuiet(settings: unknown): QuietHours | null {
  if (!settings || typeof settings !== "object") return null;
  const q = (settings as Record<string, unknown>).push_quiet;
  if (!q || typeof q !== "object") return null;
  const { from, to } = q as Record<string, unknown>;
  if (!isValidTime(from) || !isValidTime(to) || from === to) return null;
  return { from, to };
}

/** Copy of settings with the window set (or removed when null); every other key is kept. */
export function withQuiet(settings: unknown, quiet: QuietHours | null): Record<string, unknown> {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  if (quiet) base.push_quiet = { from: quiet.from, to: quiet.to };
  else delete base.push_quiet;
  return base;
}
