import { RESEARCH_KINDS, RESEARCH_STATUSES } from "@kkingg/schemas";
import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import type { FlashParams } from "../../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { addSource, deleteSource, setSourceStatus } from "./actions";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams & { status?: string }>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "academics");
  const { error, message, status } = await searchParams;
  const filter = (RESEARCH_STATUSES as readonly string[]).includes(status ?? "") ? status! : null;
  const supabase = await createClient();
  const ws = ctx.current.id;

  let q = supabase
    .from("research_sources")
    .select(
      "id, title, authors, published_year, kind, url, status, summary, tags, course_id, revision",
    )
    .eq("workspace_id", ws)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (filter) q = q.eq("status", filter);
  const [{ data: sources }, { data: courses }] = await Promise.all([
    q,
    supabase.from("courses").select("id, name, code").eq("workspace_id", ws).is("deleted_at", null),
  ]);
  const courseName = new Map(
    (courses ?? []).map((c) => [c.id, c.code ? `${c.code} · ${c.name}` : c.name]),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/academics" className="text-primary">
          ← Academics
        </a>
      </p>
      <PageHeader
        title="Research"
        subtitle="Papers, books and articles you are reading, with your own notes."
      />
      <Flash error={error} message={message} />

      <Card title="Add a source" className="mb-6">
        <form action={addSource} className="grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={300}
            placeholder="Title"
            aria-label="Title"
            className={`${inputClass} sm:col-span-4`}
          />
          <select
            name="kind"
            defaultValue="article"
            aria-label="Kind"
            className={`${inputClass} sm:col-span-2`}
          >
            {RESEARCH_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            name="authors"
            maxLength={300}
            placeholder="Authors"
            aria-label="Authors"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="publishedYear"
            type="number"
            min="1000"
            max="2200"
            placeholder="Year"
            aria-label="Year"
            className={`${inputClass} sm:col-span-1`}
          />
          <select
            name="courseId"
            defaultValue=""
            aria-label="Course"
            className={`${inputClass} sm:col-span-2`}
          >
            <option value="">No course</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {courseName.get(c.id)}
              </option>
            ))}
          </select>
          <input
            name="url"
            type="url"
            placeholder="Link (optional)"
            aria-label="Link"
            className={`${inputClass} sm:col-span-6`}
          />
          <textarea
            name="summary"
            rows={4}
            maxLength={20000}
            placeholder="Your notes and summary"
            aria-label="Notes"
            className={`${inputClass} sm:col-span-6`}
          />
          <input
            name="tags"
            placeholder="Tags, comma separated"
            aria-label="Tags"
            className={`${inputClass} sm:col-span-4`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Add source
          </button>
        </form>
      </Card>

      <p className="mb-4 flex flex-wrap gap-2 text-xs">
        <a href="/academics/research" className={`${subtleButton} ${filter ? "" : "bg-raised"}`}>
          All
        </a>
        {RESEARCH_STATUSES.map((s) => (
          <a
            key={s}
            href={`/academics/research?status=${s}`}
            className={`${subtleButton} ${filter === s ? "bg-raised" : ""}`}
          >
            {s.replace("_", " ")}
          </a>
        ))}
      </p>

      {sources?.length ? (
        <ul className="space-y-3">
          {sources.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {s.kind}
                    {s.authors ? ` · ${s.authors}` : ""}
                    {s.published_year ? ` · ${s.published_year}` : ""}
                    {s.course_id && courseName.get(s.course_id)
                      ? ` · ${courseName.get(s.course_id)}`
                      : ""}
                    {s.tags.length ? ` · ${s.tags.join(", ")}` : ""}
                  </p>
                  {s.summary && <p className="mt-2 whitespace-pre-wrap text-sm">{s.summary}</p>}
                </div>
                <div className="flex gap-2">
                  <form action={setSourceStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="revision" value={s.revision} />
                    <select
                      name="status"
                      defaultValue={s.status}
                      aria-label="Status"
                      className={`${inputClass} w-auto py-1 text-xs`}
                    >
                      {RESEARCH_STATUSES.map((x) => (
                        <option key={x} value={x}>
                          {x.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={subtleButton}>
                      Set
                    </button>
                  </form>
                  <form action={deleteSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="revision" value={s.revision} />
                    <button type="submit" className={subtleButton}>
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{filter ? "No sources with that status." : "No sources yet."}</Empty>
      )}
    </div>
  );
}
