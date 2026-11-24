// Settings helpers (profile and modules), mirroring the website's rules. Pure.

/** True when the text is an IANA time zone name the phone can use. */
export function isValidZone(tz: string): boolean {
  const t = tz.trim();
  if (!t) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: t });
    return true;
  } catch {
    return false;
  }
}

/** Trimmed name and time zone, or an error message. Name 1-80 characters, like the website. */
export function checkProfile(
  name: string,
  tz: string,
  valid: (tz: string) => boolean = isValidZone,
): { displayName: string; timezone: string } | string {
  const n = name.trim();
  if (!n) return "Enter your name.";
  if (n.length > 80) return "Use at most 80 characters for your name.";
  const z = tz.trim();
  if (!valid(z)) return "Choose a valid time zone, such as Africa/Kampala.";
  return { displayName: n, timezone: z };
}

export type RegistryModule = {
  id: string;
  name: string;
  description: string;
  core: boolean;
  dependencies: string[];
  status: string;
};

export type ModuleView = RegistryModule & {
  available: boolean;
  enabled: boolean;
  canToggle: boolean;
};

/** Registry modules with their state in this workspace. Only owners and admins can toggle, and never core modules or ones not set up in the workspace. */
export function moduleViews(
  registry: readonly RegistryModule[],
  state: ReadonlyMap<string, boolean>,
  canManage: boolean,
): ModuleView[] {
  return registry.map((m) => {
    const enabled = state.get(m.id);
    const available = enabled !== undefined;
    return {
      ...m,
      available,
      enabled: enabled === true,
      canToggle: canManage && available && !m.core,
    };
  });
}

export const canManageRole = (role: string | null | undefined) =>
  role === "owner" || role === "admin";
