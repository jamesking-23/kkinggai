import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import {
  buildRepertoire,
  drillPositions,
  formatPath,
  scorePercent,
  type RepPosition,
} from "../../../../lib/repertoire";
import { RepertoireDrill } from "../../../../components/repertoire-drill";
import { Card, Empty, PageHeader } from "../../../../components/ui";

const MAX_GAMES = 1000;
const DRILL_LIMIT = 40;

export default async function RepertoirePage() {
  const ctx = await getAppContext();
  requireModule(ctx, "chess");
  const supabase = await createClient();
  const { data } = await supabase
    .from("chess_games")
    .select("pgn, user_color, result")
    .not("user_color", "is", null)
    .is("deleted_at", null)
    .order("played_on", { ascending: false, nullsFirst: false })
    .limit(MAX_GAMES);
  const games = data ?? [];
  const all = buildRepertoire(games);
  const drill = drillPositions(all)
    .slice(0, DRILL_LIMIT)
    .map((p) => ({ ...p, moves: p.moves.slice(0, 6) }));
  const byColor = (c: "white" | "black"): RepPosition[] => all.filter((p) => p.color === c);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-2 text-sm">
        <a href="/chess" className="text-primary">
          ← Chess
        </a>
      </p>
      <PageHeader
        title="Your repertoire"
        subtitle={`Built from your ${games.length} most recent games with a known side: the first 8 moves of each, positions you reached at least twice.`}
      />

      {all.length === 0 ? (
        <Empty>
          Not enough games yet. Import games and save your player names on the Chess page so your
          side is known; positions need to appear in at least two games.
        </Empty>
      ) : (
        <>
          {drill.length > 0 ? (
            <Card title="Drill" className="mb-6">
              <RepertoireDrill positions={drill} />
            </Card>
          ) : (
            <Empty>No position has a clear main move yet, so there is nothing to drill.</Empty>
          )}

          {(["white", "black"] as const).map((c) => {
            const list = byColor(c).slice(0, 30);
            if (list.length === 0) return null;
            return (
              <Card key={c} title={`As ${c}`} className="mb-6">
                <ul className="divide-y divide-border">
                  {list.map((p) => (
                    <li key={p.color + p.key} className="py-2.5 text-sm">
                      <p className="font-medium">{formatPath(p.path)}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {p.total} games ·{" "}
                        {p.moves
                          .slice(0, 4)
                          .map((m) => {
                            const s = scorePercent(m);
                            return `${m.san} ×${m.count}${s === null ? "" : ` (${s}%)`}`;
                          })
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
                {byColor(c).length > list.length && (
                  <p className="mt-2 text-xs text-muted">
                    Showing the {list.length} most visited of {byColor(c).length} positions.
                  </p>
                )}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
