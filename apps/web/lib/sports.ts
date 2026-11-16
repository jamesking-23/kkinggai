import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import { formatKm, summariseRuns } from "./running";

/**
 * A sport adapter gives the Sports hub a few live figures for one sport module. To add a sport:
 * register its module with `group: "sports"` (lib/registry.ts) and add an adapter here. See docs/SPORTS_ARCHITECTURE.md.
 * Adapters only read through the user's own session, so row-level security still applies.
 */
export type SportContext = { userId: string; timeZone: string; now: Date };
export type SportAdapter = {
  moduleId: string;
  /** Short lines of live figures. Return an empty list when there is nothing to show yet. */
  summary(db: SupabaseClient<Database>, ctx: SportContext): Promise<string[]>;
};

export const SPORT_ADAPTERS: SportAdapter[] = [
  {
    moduleId: "chess",
    async summary(db) {
      const nowIso = new Date().toISOString();
      const [games, due] = await Promise.all([
        db.from("chess_games").select("id", { count: "exact", head: true }).is("deleted_at", null),
        db
          .from("chess_puzzles")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .lte("next_due_at", nowIso),
      ]);
      const lines: string[] = [];
      if (games.count)
        lines.push(`${games.count} game${games.count === 1 ? "" : "s"} in your history`);
      if (due.count) lines.push(`${due.count} puzzle${due.count === 1 ? "" : "s"} due`);
      return lines;
    },
  },
  {
    moduleId: "running",
    async summary(db, ctx) {
      const { data } = await db
        .from("run_activities")
        .select("started_at, distance_m, moving_seconds")
        .is("deleted_at", null)
        .gte("started_at", new Date(ctx.now.getTime() - 14 * 86_400_000).toISOString())
        .limit(500);
      const s = summariseRuns(data ?? [], ctx.now, ctx.timeZone, 1);
      return s.week.runs
        ? [
            `${formatKm(s.week.distanceM)} this week in ${s.week.runs} run${s.week.runs === 1 ? "" : "s"}`,
          ]
        : [];
    },
  },
];
