import { colors } from "@kkingg/design-tokens";
import { enabledModules, registry } from "../lib/registry";

export default function HomePage() {
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
      <main style={{ padding: 24 }}>
        <h1>Dashboard</h1>
        <p style={{ color: colors.textMuted }}>
          No data yet. Sign-in and workspaces arrive in Phase 3.
        </p>
      </main>
    </div>
  );
}
