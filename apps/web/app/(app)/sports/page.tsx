import { requireModule } from "../../../lib/modules";
import { registry } from "../../../lib/registry";
import { getAppContext } from "../../../lib/session";
import { SPORT_ADAPTERS } from "../../../lib/sports";
import { createClient } from "../../../lib/supabase/server";
import { Card, Empty, PageHeader } from "../../../components/ui";

export default async function SportsPage() {
  const ctx = await getAppContext();
  requireModule(ctx, "sports");
  const supabase = await createClient();
  const sports = registry.inGroup("sports", ctx.enabledModules);
  const now = new Date();

  const cards = await Promise.all(
    sports.map(async (m) => {
      const adapter = SPORT_ADAPTERS.find((a) => a.moduleId === m.id);
      let lines: string[] = [];
      let failed = false;
      if (adapter) {
        try {
          lines = await adapter.summary(supabase, {
            userId: ctx.userId,
            timeZone: ctx.timezone,
            now,
          });
        } catch {
          failed = true;
        }
      }
      return { m, lines, failed };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Sports" subtitle="Your sports modules at a glance." />
      {cards.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ m, lines, failed }) => (
            <a key={m.id} href={m.nav.href} className="block">
              <Card title={m.name}>
                <p className="text-sm text-muted">{m.description}</p>
                {failed ? (
                  <p className="mt-2 text-xs text-danger">Could not load the latest figures.</p>
                ) : lines.length ? (
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted">Nothing logged yet.</p>
                )}
              </Card>
            </a>
          ))}
        </div>
      ) : (
        <Empty>No sports modules are enabled. Turn them on in Settings, Modules.</Empty>
      )}
    </div>
  );
}
