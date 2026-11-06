import { colors } from "@kkingg/design-tokens";
import { redirect } from "next/navigation";
import { enabledModules, registry } from "../lib/registry";
import { createClient } from "../lib/supabase/server";
import { logout } from "./auth/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: workspaces }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("workspaces").select("id, name, kind").order("created_at"),
  ]);

  const nav = registry.navigation(enabledModules);
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: 220,
          padding: 16,
          background: colors.surface,
          borderRight: `1px solid ${colors.border}`,
        }}
      >
        <strong>KKINGG AI</strong>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {nav.map((item) => (
            <li key={item.id}>
              <a href={item.href} style={{ color: colors.text }}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ padding: 24, flex: 1 }}>
        <h1>Welcome, {profile?.display_name ?? user.email}</h1>
        <p style={{ color: colors.textMuted }}>
          Workspace: {workspaces?.map((w) => w.name).join(", ") || "none found"}
        </p>
        <form action={logout}>
          <button type="submit">Sign out</button>
        </form>
      </main>
    </div>
  );
}
