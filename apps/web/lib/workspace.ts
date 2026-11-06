export const WORKSPACE_COOKIE = "kkingg_workspace";

export type WorkspaceSummary = { id: string; name: string; kind: string };

/**
 * Picks the active workspace. The cookie is only a preference: it is honoured only when it names a
 * workspace the user can actually see (RLS already limits the list), otherwise the first one is used.
 */
export function resolveWorkspace(
  workspaces: readonly WorkspaceSummary[],
  preferredId: string | undefined,
): WorkspaceSummary | null {
  return workspaces.find((w) => w.id === preferredId) ?? workspaces[0] ?? null;
}
