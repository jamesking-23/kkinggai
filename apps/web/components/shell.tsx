"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Menu, PanelLeft, Search, Settings, X } from "lucide-react";
import { iconFor } from "./icons";

export type NavItem = { id: string; label: string; href: string; icon: string };
type Workspace = { id: string; name: string; kind: string };

type ShellProps = {
  nav: NavItem[];
  workspaces: Workspace[];
  currentWorkspaceId: string;
  displayName: string;
  email: string;
  switchWorkspace: (formData: FormData) => Promise<void>;
  logout: () => Promise<void>;
  children: ReactNode;
};

const COLLAPSE_KEY = "kkingg.sidebar.collapsed";

export function Shell(props: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // storage unavailable: keep the default
    }
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // ignore
      }
      return !c;
    });
  }

  const current = props.workspaces.find((w) => w.id === props.currentWorkspaceId);

  const sidebar = (
    <nav
      aria-label="Modules"
      className="flex h-full flex-col gap-1 border-r border-border bg-surface p-3"
    >
      <div className="mb-3 flex items-center justify-between px-2">
        {!collapsed && <span className="font-semibold tracking-wide">KKINGG AI</span>}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden rounded-md p-1.5 text-muted hover:bg-raised hover:text-text lg:block"
        >
          <PanelLeft size={18} />
        </button>
      </div>
      {props.nav.map((item) => {
        const Icon = iconFor(item.icon);
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <a
            key={item.id}
            href={item.href}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
              active ? "bg-raised text-text" : "text-muted hover:bg-raised hover:text-text"
            }`}
          >
            <Icon size={18} className={active ? "text-primary" : ""} />
            {!collapsed && <span>{item.label}</span>}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className={`hidden shrink-0 lg:block ${collapsed ? "w-16" : "w-60"}`}>{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="rounded-md p-1.5 text-muted hover:bg-raised lg:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-raised">
              <span className="max-w-32 truncate">{current?.name ?? "Workspace"}</span>
              <ChevronsUpDown size={14} className="text-muted" />
            </summary>
            <div className="absolute left-0 z-30 mt-1 min-w-52 rounded-lg border border-border bg-raised p-1 shadow-xl">
              <p className="px-3 py-1.5 text-xs uppercase tracking-wide text-muted">Workspaces</p>
              {props.workspaces.map((w) => (
                <form key={w.id} action={props.switchWorkspace}>
                  <input type="hidden" name="workspaceId" value={w.id} />
                  <button
                    type="submit"
                    aria-current={w.id === props.currentWorkspaceId ? "true" : undefined}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface ${
                      w.id === props.currentWorkspaceId ? "text-primary" : ""
                    }`}
                  >
                    <span className="truncate">{w.name}</span>
                    <span className="ml-3 text-xs text-muted">{w.kind}</span>
                  </button>
                </form>
              ))}
            </div>
          </details>

          <ModuleSearch nav={props.nav} />

          <details className="relative ml-auto">
            <summary
              aria-label="Account menu"
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-accent text-sm font-semibold"
            >
              {props.displayName.trim().charAt(0).toUpperCase() || "?"}
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-border bg-raised p-1 shadow-xl">
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-sm font-medium">{props.displayName}</p>
                <p className="truncate text-xs text-muted">{props.email}</p>
              </div>
              <a
                href="/settings"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface"
              >
                <Settings size={15} /> Settings
              </a>
              <form action={props.logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </form>
            </div>
          </details>
        </header>

        <main className="flex-1 p-6">{props.children}</main>
      </div>
    </div>
  );
}

/** Jumps to a module, or runs a universal search across records on Enter. */
function ModuleSearch({ nav }: { nav: NavItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? nav.filter((n) => n.label.toLowerCase().includes(q)) : [];
  }, [nav, query]);

  return (
    <div className="relative hidden max-w-sm flex-1 sm:block">
      <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-muted" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim().length >= 2) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            setQuery("");
          }
          if (e.key === "Escape") setQuery("");
        }}
        placeholder="Search everything…"
        aria-label="Search everything"
        className="w-full rounded-md border border-border bg-bg py-2 pl-9 pr-3 text-sm placeholder:text-muted"
      />
      {query.trim() && (
        <ul className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-raised p-1 shadow-xl">
          {query.trim().length >= 2 && (
            <li>
              <a
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => setQuery("")}
                className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
              >
                Search everything for “{query.trim()}”
              </a>
            </li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <a
                href={r.href}
                onClick={() => setQuery("")}
                className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
              >
                {r.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
