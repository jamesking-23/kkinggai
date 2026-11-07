import { getAppContext } from "../../lib/session";
import { createClient } from "../../lib/supabase/server";
import { goalProgress, isOverdue } from "../../lib/productivity";
import { addDays, localDate, zonedTimeToUtc } from "../../lib/time";
import { Card, Empty, ProgressBar } from "../../components/ui";

type Task = { id: string; title: string; status: string; due_at: string | null };
type Event = { id: string; title: string; starts_at: string; ends_at: string };
type Goal = {
  id: string;
  title: string;
  current_value: number;
  target_value: number | null;
  unit: string | null;
};

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const now = new Date();
  const today = localDate(now, ctx.timezone);
  const dayStart = zonedTimeToUtc(`${today}T00:00`, ctx.timezone).toISOString();
  const dayEnd = zonedTimeToUtc(`${addDays(today, 1)}T00:00`, ctx.timezone).toISOString();
  const ws = ctx.current.id;

  const [tasks, events, goals, projects] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_at")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .in("status", ["todo", "in_progress"])
      .order("due_at", { nullsFirst: false })
      .limit(100),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd)
      .order("starts_at"),
    supabase
      .from("goals")
      .select("id, title, current_value, target_value, unit")
      .eq("workspace_id", ws)
      .eq("status", "active")
      .limit(5),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws)
      .eq("status", "active"),
  ]);

  const open = (tasks.data ?? []) as Task[];
  const overdue = open.filter((t) => isOverdue(t, now));
  const upcoming = open.filter((t) => t.due_at && !isOverdue(t, now)).slice(0, 5);
  const todayEvents = (events.data ?? []) as Event[];
  const activeGoals = (goals.data ?? []) as Goal[];

  const dateLabel = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: ctx.timezone,
  }).format(now);
  const time = new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: ctx.timezone });
  const dueFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: ctx.timezone });
  const isEmpty =
    open.length === 0 && todayEvents.length === 0 && activeGoals.length === 0 && !projects.count;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-muted">{dateLabel}</p>
      <h1 className="mt-1 text-2xl font-semibold">Welcome, {ctx.displayName}</h1>
      <p className="mt-1 text-sm text-muted">Workspace: {ctx.current.name}</p>

      {isEmpty && (
        <Card className="mt-6" title="Get started">
          <p className="text-sm text-muted">
            Nothing here yet. Add a{" "}
            <a href="/tasks" className="text-primary">
              task
            </a>
            , set a{" "}
            <a href="/goals" className="text-primary">
              goal
            </a>{" "}
            or schedule an{" "}
            <a href="/calendar" className="text-primary">
              event
            </a>{" "}
            and it will appear on this page.
          </p>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title="Today's schedule">
          {todayEvents.length ? (
            <ul className="space-y-2 text-sm">
              {todayEvents.map((e) => (
                <li key={e.id}>
                  <span className="text-muted">
                    {time.format(new Date(e.starts_at))}–{time.format(new Date(e.ends_at))}
                  </span>{" "}
                  {e.title}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No events today.</Empty>
          )}
        </Card>

        <Card title={`Tasks${overdue.length ? ` · ${overdue.length} overdue` : ""}`}>
          {overdue.length + upcoming.length ? (
            <ul className="space-y-2 text-sm">
              {overdue.slice(0, 5).map((t) => (
                <li key={t.id} className="text-danger">
                  {t.title}{" "}
                  <span className="text-xs">(due {dueFmt.format(new Date(t.due_at!))})</span>
                </li>
              ))}
              {upcoming.map((t) => (
                <li key={t.id}>
                  {t.title}{" "}
                  <span className="text-xs text-muted">
                    (due {dueFmt.format(new Date(t.due_at!))})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {open.length ? `${open.length} open task(s) with no due date.` : "No open tasks."}
            </Empty>
          )}
          <a href="/tasks" className="mt-3 inline-block text-xs text-primary">
            All tasks
          </a>
        </Card>

        <Card title="Active goals">
          {activeGoals.length ? (
            <ul className="space-y-3 text-sm">
              {activeGoals.map((g) => {
                const pct = goalProgress(
                  Number(g.current_value),
                  g.target_value === null ? null : Number(g.target_value),
                );
                return (
                  <li key={g.id}>
                    <p>
                      {g.title}
                      {pct !== null ? <span className="text-xs text-muted"> · {pct}%</span> : null}
                    </p>
                    {pct !== null && (
                      <div className="mt-1">
                        <ProgressBar percent={pct} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No active goals.</Empty>
          )}
        </Card>

        <Card title="Projects">
          <p className="text-sm">{projects.count ?? 0} active project(s)</p>
          <a href="/projects" className="mt-3 inline-block text-xs text-primary">
            All projects
          </a>
        </Card>
      </div>
    </div>
  );
}
