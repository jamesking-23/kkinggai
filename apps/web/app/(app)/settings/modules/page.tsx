import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { Card, Flash, PageHeader, primaryButton, subtleButton } from "../../../../components/ui";
import type { FlashParams } from "../../../../lib/form";
import { toggleModule } from "./actions";

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const [{ data: registry }, { data: wsModules }, { data: member }] = await Promise.all([
    supabase.from("module_registry").select("*").order("nav_order"),
    supabase
      .from("workspace_modules")
      .select("module_id, enabled")
      .eq("workspace_id", ctx.current.id),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", ctx.current.id)
      .eq("user_id", ctx.userId)
      .maybeSingle(),
  ]);
  const state = new Map((wsModules ?? []).map((m) => [m.module_id, m.enabled]));
  const canManage = member?.role === "owner" || member?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Modules"
        subtitle={`Choose which modules are active in ${ctx.current.name}. Disabled modules disappear from the sidebar; your data is kept.`}
      />
      <Flash error={error} message={message} />
      {!canManage && (
        <p className="mb-4 text-sm text-muted">
          Only workspace owners and admins can change modules.
        </p>
      )}

      <ul className="space-y-3">
        {(registry ?? []).map((m) => {
          const enabled = state.get(m.id);
          const available = enabled !== undefined;
          return (
            <li key={m.id}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {m.name}{" "}
                      <span className="ml-1 text-xs font-normal text-muted">
                        v{m.version} · {m.status}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted">{m.description}</p>
                    {m.dependencies.length > 0 && (
                      <p className="mt-1 text-xs text-muted">
                        Requires: {m.dependencies.join(", ")}
                      </p>
                    )}
                    {m.core && <p className="mt-1 text-xs text-muted">Core module — always on.</p>}
                  </div>
                  {!available ? (
                    <span className="shrink-0 text-xs text-muted">Not available yet</span>
                  ) : canManage && !m.core ? (
                    <form action={toggleModule} className="shrink-0">
                      <input type="hidden" name="moduleId" value={m.id} />
                      <input type="hidden" name="enable" value={enabled ? "0" : "1"} />
                      <button type="submit" className={enabled ? subtleButton : primaryButton}>
                        {enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">
                      {enabled ? "Enabled" : "Disabled"}
                    </span>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
