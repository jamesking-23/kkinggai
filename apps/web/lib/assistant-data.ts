import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantData } from "@kkingg/assistant";
import type { Database } from "./supabase/database.types";
import { buildCoachContext } from "./coach";
import { PRIORITY_LABELS } from "./productivity";
import { zonedTimeToUtc } from "./time";

/**
 * The offline assistant's window onto the user's data. Every call goes through the caller's own Supabase session,
 * so row-level security applies exactly as on the website. Nothing here talks to an AI provider.
 */
export function supabaseAssistantData(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  timeZone: string,
  now: () => Date = () => new Date(),
): AssistantData {
  const fail = (what: string): never => {
    throw new Error(`Could not ${what}.`);
  };

  return {
    async openTasks(limit) {
      const { data, error } = await supabase
        .from("tasks")
        .select("title, due_at, priority")
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"])
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(limit);
      if (error) fail("read your tasks");
      return (data ?? []).map((t) => ({
        title: t.title,
        dueAt: t.due_at,
        priority: PRIORITY_LABELS[t.priority] ?? "Normal",
      }));
    },

    async addTask({ title, dueDate }) {
      const { error } = await supabase.from("tasks").insert({
        workspace_id: workspaceId,
        title,
        priority: 3,
        // A date with no time means "by the end of that day" in the user's own timezone.
        due_at: dueDate ? zonedTimeToUtc(`${dueDate}T23:59`, timeZone).toISOString() : null,
      });
      if (error) fail("add the task");
    },

    async addIdea(title) {
      const { error } = await supabase
        .from("idea_backlog")
        .insert({ workspace_id: workspaceId, title });
      if (error) fail("save the idea");
    },

    async habitsToday(today) {
      const [h, l] = await Promise.all([
        supabase.from("habits").select("id, name").is("archived_at", null).order("created_at"),
        supabase.from("habit_logs").select("habit_id").eq("log_date", today),
      ]);
      if (h.error || l.error) fail("read your habits");
      const done = new Set((l.data ?? []).map((x) => x.habit_id));
      return (h.data ?? []).map((x) => ({ name: x.name, done: done.has(x.id) }));
    },

    async goals() {
      const { data, error } = await supabase
        .from("goals")
        .select("title, current_value, target_value, unit, deadline")
        .eq("status", "active")
        .order("deadline", { ascending: true, nullsFirst: false })
        .limit(20);
      if (error) fail("read your goals");
      return (data ?? []).map((g) => ({
        title: g.title,
        current: g.current_value,
        target: g.target_value ?? 0,
        unit: g.unit,
        deadline: g.deadline,
      }));
    },

    async runningReport() {
      const n = now();
      const since = new Date(n.getTime() - 56 * 86_400_000).toISOString();
      const [runs, plan] = await Promise.all([
        supabase
          .from("run_activities")
          .select("started_at, kind, distance_m, moving_seconds, elevation_gain_m, avg_hr, effort")
          .is("deleted_at", null)
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .limit(300),
        supabase
          .from("run_plans")
          .select("id, goal, race_date, weeks, days_per_week")
          .eq("status", "active")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (runs.error || plan.error) fail("read your runs");
      const sessions = plan.data
        ? (
            await supabase
              .from("run_plan_sessions")
              .select("planned_on, kind, distance_m, status")
              .eq("plan_id", plan.data.id)
              .order("planned_on", { ascending: true })
              .limit(400)
          ).data
        : [];
      return buildCoachContext({
        runs: runs.data ?? [],
        plan: plan.data ?? null,
        sessions: sessions ?? [],
        now: n,
        timeZone,
      });
    },

    async logRun({ date, distanceM, seconds }) {
      const { error } = await supabase.from("run_activities").insert({
        user_id: userId,
        source: "manual",
        kind: "easy",
        // Manual runs have no clock time; noon UTC keeps them on the right local day in East Africa and most zones.
        started_at: `${date}T12:00:00Z`,
        distance_m: distanceM,
        moving_seconds: seconds,
        name: "Run (via assistant)",
      });
      if (error) fail("log the run");
    },

    async unreadNotifications() {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (error) fail("read your notifications");
      return count ?? 0;
    },

    async importantDates() {
      const { data, error } = await supabase
        .from("important_dates")
        .select("title, month, day, year")
        .is("deleted_at", null)
        .limit(500);
      if (error) fail("read your dates");
      return data ?? [];
    },

    async search(query) {
      const { data, error } = await supabase.rpc("search_workspace", {
        ws: workspaceId,
        q: query,
        per_kind: 5,
      });
      if (error) fail("search");
      return (data ?? []).map((r) => ({ kind: r.kind, title: r.title }));
    },

    async flashcardsDue() {
      const { count, error } = await supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .lte("due_at", now().toISOString());
      if (error) fail("read your flashcards");
      return count ?? 0;
    },
  };
}
