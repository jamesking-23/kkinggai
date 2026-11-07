import { IDEA_STATUSES } from "@kkingg/schemas";
import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { PRIORITY_LABELS } from "../../../lib/productivity";
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
import { captureIdea, deleteIdea, setIdeaStatus } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  captured: "Captured",
  planned: "Planned",
  in_development: "In development",
  active: "Active",
  experimental: "Experimental",
  deprecated: "Deprecated",
};

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams & { status?: string }>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "ideas");
  const { error, message, status } = await searchParams;
  const filter = IDEA_STATUSES.find((s) => s === status);

  const supabase = await createClient();
  let query = supabase
    .from("idea_backlog")
    .select(
      "id, title, description, category, priority, status, related_module, notes, revision, created_at",
    )
    .eq("workspace_id", ctx.current.id)
    .is("deleted_at", null)
    .order("priority")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter) query = query.eq("status", filter);

  const [{ data: ideas }, { data: modules }] = await Promise.all([
    query,
    supabase.from("module_registry").select("id, name").order("name"),
  ]);
  const moduleName = new Map((modules ?? []).map((m) => [m.id, m.name]));
  const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: ctx.timezone });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Idea Inbox"
        subtitle="Capture product ideas now, decide what to build later."
      />
      <Flash error={error} message={message} />

      <Card className="mb-6">
        <form action={captureIdea} className="grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="What's the idea?"
            aria-label="Idea title"
            className={`${inputClass} sm:col-span-6`}
          />
          <textarea
            name="description"
            rows={2}
            maxLength={4000}
            placeholder="Describe it (optional)"
            aria-label="Description"
            className={`${inputClass} sm:col-span-6`}
          />
          <input
            name="category"
            maxLength={60}
            placeholder="Category"
            aria-label="Category"
            className={`${inputClass} sm:col-span-2`}
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
          <select
            name="relatedModule"
            aria-label="Related module"
            className={`${inputClass} sm:col-span-2`}
          >
            <option value="">No related module</option>
            {(modules ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <textarea
            name="notes"
            rows={2}
            maxLength={4000}
            placeholder="Notes (optional)"
            aria-label="Notes"
            className={`${inputClass} sm:col-span-6`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-6`}>
            Capture idea
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          Voice capture arrives with the voice features in a later phase.
        </p>
      </Card>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <a href="/ideas" className={filter ? "text-muted" : "font-medium"}>
          All
        </a>
        {IDEA_STATUSES.map((s) => (
          <a
            key={s}
            href={`/ideas?status=${s}`}
            className={filter === s ? "font-medium" : "text-muted"}
          >
            {STATUS_LABELS[s]}
          </a>
        ))}
      </div>

      {ideas?.length ? (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <li key={idea.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{idea.title}</p>
                  {idea.description && (
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">
                      {idea.description}
                    </p>
                  )}
                  {idea.notes && (
                    <p className="mt-1 whitespace-pre-line text-xs text-muted">
                      Notes: {idea.notes}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    {PRIORITY_LABELS[idea.priority]}
                    {idea.category ? ` · ${idea.category}` : ""}
                    {idea.related_module
                      ? ` · ${moduleName.get(idea.related_module) ?? idea.related_module}`
                      : ""}
                    {` · captured ${dateFmt.format(new Date(idea.created_at))}`}
                  </p>
                </div>
                <form action={deleteIdea}>
                  <input type="hidden" name="id" value={idea.id} />
                  <input type="hidden" name="revision" value={idea.revision} />
                  <button type="submit" className={subtleButton}>
                    Delete
                  </button>
                </form>
              </div>
              <form action={setIdeaStatus} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={idea.id} />
                <input type="hidden" name="revision" value={idea.revision} />
                <select
                  name="status"
                  defaultValue={idea.status}
                  aria-label="Status"
                  className={`${inputClass} max-w-48`}
                >
                  {IDEA_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button type="submit" className={subtleButton}>
                  Update status
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          {filter ? "No ideas with this status." : "No ideas yet. Capture the first one above."}
        </Empty>
      )}
    </div>
  );
}
