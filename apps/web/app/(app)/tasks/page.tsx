import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { isOverdue, PRIORITY_LABELS } from "../../../lib/productivity";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
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
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams & { show?: string }>;
}) {
  const ctx = await getAppContext();
  const { error, message, show } = await searchParams;
  const showDone = show === "all";

  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, title, status, priority, category, due_at, revision, project_id")
    .eq("workspace_id", ctx.current.id)
    .is("deleted_at", null)
    .is("parent_task_id", null)
    .order("priority")
    .order("due_at", { nullsFirst: false })
    .limit(200);
  if (!showDone) query = query.in("status", ["todo", "in_progress"]);

  const [{ data: tasks }, { data: projects }] = await Promise.all([
    query,
    supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", ctx.current.id)
      .eq("status", "active"),
  ]);
  const projectName = new Map(
    (projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: ctx.timezone });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tasks" subtitle={`Workspace: ${ctx.current.name}`} />
      <Flash error={error} message={message} />

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
          <input
            name="category"
            maxLength={60}
            placeholder="Category (optional)"
            aria-label="Category"
            className={`${inputClass} sm:col-span-4`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Add task
          </button>
        </form>
      </Card>

      <div className="mb-3 flex gap-2 text-sm">
        <a href="/tasks" className={showDone ? "text-muted" : "font-medium"}>
          Open
        </a>
        <span className="text-muted">·</span>
        <a href="/tasks?show=all" className={showDone ? "font-medium" : "text-muted"}>
          All
        </a>
      </div>

      {(tasks as Task[] | null)?.length ? (
        <ul className="space-y-2">
          {(tasks as Task[]).map((t) => {
            const done = t.status === "done";
            const overdue = isOverdue(t, now);
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
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
                  <p className={`truncate text-sm ${done ? "text-muted line-through" : ""}`}>
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {PRIORITY_LABELS[t.priority]}
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
          })}
        </ul>
      ) : (
        <Empty>{showDone ? "No tasks yet." : "No open tasks. Add one above."}</Empty>
      )}
    </div>
  );
}
