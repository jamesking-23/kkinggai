// Which notification kinds may be pushed: user_settings.settings.push_kinds = string[] (absent = all). Safe for client components.
// The database function push_kind_enabled() applies the same rule.

export const PUSH_KINDS = [
  { id: "date", label: "Important dates" },
  { id: "application", label: "Application deadlines" },
  { id: "venture_task", label: "Venture tasks" },
  { id: "puzzles", label: "Due puzzles" },
  { id: "reminder", label: "Reminders" },
] as const;

export type PushKind = (typeof PUSH_KINDS)[number]["id"];
const IDS: readonly string[] = PUSH_KINDS.map((k) => k.id);

/** Keeps only known kinds, once each, in the standard order. */
export function sanitizeKinds(input: unknown): PushKind[] {
  if (!Array.isArray(input)) return [];
  return PUSH_KINDS.map((k) => k.id).filter((id) => input.includes(id));
}

/** Kinds allowed to push. Everything when nothing was saved; the saved list otherwise (may be empty). */
export function extractKinds(settings: unknown): PushKind[] {
  if (settings && typeof settings === "object") {
    const v = (settings as Record<string, unknown>).push_kinds;
    if (Array.isArray(v)) return sanitizeKinds(v.filter((x) => IDS.includes(String(x))));
  }
  return PUSH_KINDS.map((k) => k.id);
}

/** Copy of settings with the list stored (or removed when every kind is allowed); other keys are kept. */
export function withKinds(settings: unknown, kinds: unknown): Record<string, unknown> {
  const base =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  const clean = sanitizeKinds(kinds);
  if (clean.length === PUSH_KINDS.length) delete base.push_kinds;
  else base.push_kinds = clean;
  return base;
}
