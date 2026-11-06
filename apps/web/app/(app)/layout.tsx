import type { ReactNode } from "react";
import { Shell } from "../../components/shell";
import { registry } from "../../lib/registry";
import { getAppContext } from "../../lib/session";
import { logout } from "../auth/actions";
import { switchWorkspace } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getAppContext();
  // Navigation is derived from the registry plus this workspace's enabled modules.
  const nav = registry.navigation(ctx.enabledModules).map(({ id, label, href, icon }) => ({
    id,
    label,
    href,
    icon,
  }));

  return (
    <Shell
      nav={nav}
      workspaces={ctx.workspaces}
      currentWorkspaceId={ctx.current.id}
      displayName={ctx.displayName}
      email={ctx.email}
      switchWorkspace={switchWorkspace}
      logout={logout}
    >
      {children}
    </Shell>
  );
}
