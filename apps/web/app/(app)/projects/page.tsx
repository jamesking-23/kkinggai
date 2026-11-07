import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
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
import { createProject, setProjectStatus } from "./actions";

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  due_date: string | null;
  revision: number;
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const [{ data: projects }, { data: openTasks }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, status, due_date, revision")
      .eq("workspace_id", ctx.current.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("project_id")
      .eq("workspace_id", ctx.current.id)
      .is("deleted_at", null)
      .in("status", ["todo", "in_progress"])
      .not("project_id", "is", null),
  ]);
  const openCount = new Map<string, number>();
  for (const t of (openTasks ?? []) as { project_id: string }[]) {
    openCount.set(t.project_id, (openCount.get(t.project_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Projects" subtitle={`Workspace: ${ctx.current.name}`} />
      <Flash error={error} message={message} />

      <Card className="mb-6">
        <form action={createProject} className="grid gap-3 sm:grid-cols-6">
          <input
            name="name"
            required
            maxLength={200}
            placeholder="Project name"
            aria-label="Project name"
            className={`${inputClass} sm:col-span-4`}
          />
          <input
            name="dueDate"
            type="date"
            aria-label="Due date"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="description"
            maxLength={2000}
            placeholder="Description (optional)"
            aria-label="Description"
            className={`${inputClass} sm:col-span-4`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Create project
          </button>
        </form>
      </Card>

      {(projects as Project[] | null)?.length ? (
        <ul className="space-y-3">
          {(projects as Project[]).map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {p.status} · {openCount.get(p.id) ?? 0} open task(s)
                    {p.due_date ? ` · due ${p.due_date}` : ""}
                  </p>
                </div>
                <form action={setProjectStatus} className="flex shrink-0 gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="revision" value={p.revision} />
                  {p.status === "active" ? (
                    <>
                      <button name="status" value="completed" className={subtleButton}>
                        Complete
                      </button>
                      <button name="status" value="archived" className={subtleButton}>
                        Archive
                      </button>
                    </>
                  ) : (
                    <button name="status" value="active" className={subtleButton}>
                      Reactivate
                    </button>
                  )}
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No projects yet. Create one above, then assign tasks to it.</Empty>
      )}
    </div>
  );
}
