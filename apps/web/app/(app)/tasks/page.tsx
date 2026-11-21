import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { isOverdue, PRIORITY_LABELS } from "../../../lib/productivity";
import { PLAN_BUCKETS, planTasks } from "../../../lib/planning";
import { localDate } from "../../../lib/time";
import { labelForRule, RECURRENCES } from "../../../lib/recurrence";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  StatTile,
  subtleButton,
} from "../../../components/ui";
import type { FlashParams } from "../../../lib/form";
import { createTask, deleteTask, toggleTask } from "./actions";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  category: string | null;
  due_at: string | null;
  revision: number;
  project_id: string | null;
  recurrence_rule: string | null;
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams & { show?: string; view?: string }>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "tasks");
  const { error, message, show, view } = await searchParams;
  const planView = view === "plan";
  const showDone = !planView && show === "all";

  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, status, priority, category, due_at, revision, project_id, recurrence_rule")
    .eq("workspace_id", ctx.current.id)
    .is("deleted_at", null)
    .is("parent_task_id", null)
    .order("priority")
    .order("due_at", { nullsFirst: false })
    .limit(200);
  if (!showDone) query = query.in("status", ["todo", "in_progress"]);

  const nowIso = new Date().toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const open = () =>
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.current.id)
      .is("deleted_at", null)
      .is("parent_task_id", null);
  const [{ data: tasks }, { data: projects }, openCount, overdueCount, doneWeek] =
    await Promise.all([
      query,
      supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", ctx.current.id)
        .eq("status", "active"),
      open().in("status", ["todo", "in_progress"]),
      open().in("status", ["todo", "in_progress"]).lt("due_at", nowIso),
      open().eq("status", "done").gte("completed_at", weekAgo),
    ]);
  const projectName = new Map(
    (projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );
  const now = new Date();
  const plan = planTasks(
    (tasks as Task[] | null) ?? [],
    localDate(now, ctx.timezone),
    ctx.timezone,
  );
  const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: ctx.timezone });

  const row = (t: Task) => {
    const done = t.status === "done";
    const overdue = isOverdue(t, now);
    return (
      <li
        key={t.id}
        className="flex items-center gap-3 row-card rounded-xl border border-border px-4 py-3"
      >
        <form action={toggleTask}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="revision" value={t.revision} />
          <input type="hidden" name="done" value={done ? "0" : "1"} />
          <button
            type="submit"
            aria-label={done ? "Reopen task" : "Mark done"}
            className={`h-5 w-5 rounded-full border ${done ? "border-success bg-success" : "border-muted"}`}
          />
        </form>
        <div className="min-w-0 flex-1">
          <a
            href={`/tasks/${t.id}`}
            className={`block truncate text-sm hover:underline ${done ? "text-muted line-through" : ""}`}
          >
            {t.title}
          </a>
          <p className="mt-0.5 text-xs text-muted">
            {PRIORITY_LABELS[t.priority]}
            {t.recurrence_rule
              ? ` · ↻ ${labelForRule(t.recurrence_rule)?.toLowerCase() ?? "repeats"}`
              : ""}
            {t.category ? ` · ${t.category}` : ""}
            {t.project_id && projectName.get(t.project_id)
              ? ` · ${projectName.get(t.project_id)}`
              : ""}
            {t.due_at ? (
              <span className={overdue ? "text-danger" : ""}>
                {" "}
                · Due {fmt.format(new Date(t.due_at))}
                {overdue ? " (overdue)" : ""}
              </span>
            ) : null}
          </p>
        </div>
        <form action={deleteTask}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="revision" value={t.revision} />
          <button type="submit" className={subtleButton}>
            Delete
          </button>
        </form>
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tasks" subtitle={`Workspace: ${ctx.current.name}`} />
      <Flash error={error} message={message} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile label="Open" value={openCount.count ?? 0} />
        <StatTile
          label="Overdue"
          value={overdueCount.count ?? 0}
          tone={(overdueCount.count ?? 0) > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Done this week"
          value={doneWeek.count ?? 0}
          tone={(doneWeek.count ?? 0) > 0 ? "success" : "default"}
        />
      </div>

      <Card className="mb-6">
        <form action={createTask} className="grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={300}
            placeholder="What needs doing?"
            aria-label="Task title"
            className={`${inputClass} sm:col-span-6`}
          />
          <select
            name="priority"
            defaultValue="3"
            aria-label="Priority"
            className={`${inputClass} sm:col-span-2`}
          >
            {Object.entries(PRIORITY_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <input
            name="dueDate"
            type="date"
            aria-label="Due date"
            className={`${inputClass} sm:col-span-2`}
          />
          <select name="projectId" aria-label="Project" className={`${inputClass} sm:col-span-2`}>
            <option value="">No project</option>
            {(projects ?? []).map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="repeat"
            defaultValue=""
            aria-label="Repeats"
            className={`${inputClass} sm:col-span-3`}
          >
            <option value="">Does not repeat</option>
            {RECURRENCES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            name="category"
            maxLength={60}
            placeholder="Category (optional)"
            aria-label="Category"
            className={`${inputClass} sm:col-span-3`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Add task
          </button>
        </form>
      </Card>

      <div className="mb-3 flex gap-2 text-sm">
        <a href="/tasks" className={!planView && !showDone ? "font-medium" : "text-muted"}>
          Open
        </a>
        <span className="text-muted">·</span>
        <a href="/tasks?view=plan" className={planView ? "font-medium" : "text-muted"}>
          Plan
        </a>
        <span className="text-muted">·</span>
        <a href="/tasks?show=all" className={showDone ? "font-medium" : "text-muted"}>
          All
        </a>
      </div>

      {planView ? (
        <div className="space-y-6">
          {PLAN_BUCKETS.map((b) => {
            const items = plan[b.id];
            if (items.length === 0) return null;
            return (
              <section key={b.id}>
                <h2
                  className={`mb-2 text-sm font-medium ${b.id === "overdue" ? "text-danger" : ""}`}
                >
                  {b.label} <span className="text-muted">({items.length})</span>
                </h2>
                <ul className="space-y-2">{items.map((t) => row(t))}</ul>
              </section>
            );
          })}
          {PLAN_BUCKETS.every((b) => plan[b.id].length === 0) && (
            <Empty>Nothing to plan. Add a task above.</Empty>
          )}
        </div>
      ) : (tasks as Task[] | null)?.length ? (
        <ul className="space-y-2">{(tasks as Task[]).map((t) => row(t))}</ul>
      ) : (
        <Empty>{showDone ? "No tasks yet." : "No open tasks. Add one above."}</Empty>
      )}
    </div>
  );
}
