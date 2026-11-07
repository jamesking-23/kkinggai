import { notFound } from "next/navigation";
import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { PRIORITY_LABELS } from "../../../../lib/productivity";
import { localDate } from "../../../../lib/time";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import type { FlashParams } from "../../../../lib/form";
import { dismissReminder } from "../../reminder-actions";
import { addReminder, addSubtask, toggleSubtask, updateTask } from "./actions";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const ctx = await getAppContext();
  requireModule(ctx, "tasks");
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ctx.current.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) notFound();

  const [{ data: subtasks }, { data: reminders }, { data: projects }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, revision")
      .eq("parent_task_id", id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("reminders")
      .select("id, message, remind_at")
      .eq("target_type", "task")
      .eq("target_id", id)
      .is("dismissed_at", null)
      .order("remind_at"),
    supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", ctx.current.id)
      .eq("status", "active"),
  ]);
  const when = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ctx.timezone,
  });
  const isSubtask = task.parent_task_id !== null;
  const back = `/tasks/${id}`;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href={isSubtask ? `/tasks/${task.parent_task_id}` : "/tasks"} className="text-primary">
          ← {isSubtask ? "Parent task" : "All tasks"}
        </a>
      </p>
      <PageHeader title={task.title} subtitle={`Status: ${task.status}`} />
      <Flash error={error} message={message} />

      <Card title="Details" className="mb-6">
        <form action={updateTask} className="grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="revision" value={task.revision} />
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={task.title}
            aria-label="Title"
            className={`${inputClass} sm:col-span-6`}
          />
          <textarea
            name="description"
            rows={3}
            maxLength={4000}
            defaultValue={task.description}
            placeholder="Description"
            aria-label="Description"
            className={`${inputClass} sm:col-span-6`}
          />
          <select
            name="priority"
            defaultValue={String(task.priority)}
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
            defaultValue={task.due_at ? localDate(task.due_at, ctx.timezone) : ""}
            aria-label="Due date"
            className={`${inputClass} sm:col-span-2`}
          />
          <select
            name="projectId"
            defaultValue={task.project_id ?? ""}
            aria-label="Project"
            className={`${inputClass} sm:col-span-2`}
          >
            <option value="">No project</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="category"
            maxLength={60}
            defaultValue={task.category ?? ""}
            placeholder="Category"
            aria-label="Category"
            className={`${inputClass} sm:col-span-4`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Save changes
          </button>
        </form>
      </Card>

      {!isSubtask && (
        <Card title="Subtasks" className="mb-6">
          {subtasks?.length ? (
            <ul className="mb-4 space-y-2">
              {subtasks.map((s) => {
                const done = s.status === "done";
                return (
                  <li key={s.id} className="flex items-center gap-3">
                    <form action={toggleSubtask}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="parentId" value={id} />
                      <input type="hidden" name="revision" value={s.revision} />
                      <input type="hidden" name="done" value={done ? "0" : "1"} />
                      <button
                        type="submit"
                        aria-label={done ? "Reopen subtask" : "Mark subtask done"}
                        className={`h-4 w-4 rounded-full border ${done ? "border-success bg-success" : "border-muted"}`}
                      />
                    </form>
                    <a
                      href={`/tasks/${s.id}`}
                      className={`text-sm ${done ? "text-muted line-through" : ""}`}
                    >
                      {s.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mb-4">
              <Empty>No subtasks yet.</Empty>
            </div>
          )}
          <form action={addSubtask} className="flex gap-2">
            <input type="hidden" name="parentId" value={id} />
            <input
              name="title"
              required
              maxLength={300}
              placeholder="Add a subtask"
              aria-label="Subtask title"
              className={inputClass}
            />
            <button type="submit" className={subtleButton}>
              Add
            </button>
          </form>
        </Card>
      )}

      <Card title="Reminders">
        {reminders?.length ? (
          <ul className="mb-4 space-y-2">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {r.message}{" "}
                  <span className="text-xs text-muted">· {when.format(new Date(r.remind_at))}</span>
                </span>
                <form action={dismissReminder}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="back" value={back} />
                  <button type="submit" className={subtleButton}>
                    Dismiss
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-4">
            <Empty>No reminders for this task.</Empty>
          </div>
        )}
        <form action={addReminder} className="grid gap-2 sm:grid-cols-6">
          <input type="hidden" name="taskId" value={id} />
          <input
            name="message"
            required
            maxLength={500}
            defaultValue={`Reminder: ${task.title}`.slice(0, 500)}
            aria-label="Reminder message"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="remindAt"
            type="datetime-local"
            required
            defaultValue={`${localDate(new Date(), ctx.timezone)}T09:00`}
            aria-label="Remind at"
            className={`${inputClass} sm:col-span-2`}
          />
          <button type="submit" className={subtleButton}>
            Add
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          Reminders appear on your dashboard when due. Push and email delivery arrive with the
          notifications phase.
        </p>
      </Card>
    </div>
  );
}
