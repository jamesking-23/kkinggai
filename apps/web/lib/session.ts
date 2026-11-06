import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { resolveWorkspace, WORKSPACE_COOKIE, type WorkspaceSummary } from "./workspace";

export type AppContext = {
  userId: string;
  email: string;
  displayName: string;
  timezone: string;
  workspaces: WorkspaceSummary[];
  current: WorkspaceSummary;
  enabledModules: ReadonlySet<string>;
};

/** Loads everything the shell needs in one place. Redirects to /login when signed out. */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }, { data: workspaces }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_settings").select("timezone").eq("user_id", user.id).maybeSingle(),
    supabase.from("workspaces").select("id, name, kind").order("created_at"),
  ]);

  const cookieStore = await cookies();
  const current = resolveWorkspace(workspaces ?? [], cookieStore.get(WORKSPACE_COOKIE)?.value);
  if (!current) {
    // Signup provisioning should always create a workspace; fail loudly rather than render a broken shell.
    throw new Error("No workspace found for this account");
  }

  const { data: mods } = await supabase
    .from("workspace_modules")
    .select("module_id")
    .eq("workspace_id", current.id)
    .eq("enabled", true);

  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? user.email ?? "You",
    timezone: settings?.timezone ?? "UTC",
    workspaces: workspaces ?? [],
    current,
    enabledModules: new Set((mods ?? []).map((m) => m.module_id)),
  };
});
