import type { ReactNode } from "react";
import { Shell } from "../../components/shell";
import { registry } from "../../lib/registry";
import { getAppContext } from "../../lib/session";
import { createClient } from "../../lib/supabase/server";
import { logout } from "../auth/actions";
import { switchWorkspace } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getAppContext();
  // Navigation is derived from the registry plus this workspace's enabled modules.
  // The notifications entry shows how many are unread. A failed count just shows no badge.
  let unread = 0;
  if (ctx.enabledModules.has("notifications")) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    unread = count ?? 0;
  }
  const nav = registry.navigation(ctx.enabledModules).map(({ id, label, href, icon }) => ({
    id,
    label,
    href,
    icon,
    badge: id === "notifications" ? unread : undefined,
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
