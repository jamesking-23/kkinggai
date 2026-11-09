import { APPLICATION_STATUSES, INTERVIEW_CATEGORIES, PORTFOLIO_KINDS } from "@kkingg/schemas";
import { requireModule } from "../../../lib/modules";
import { dueSoon, pipelineCounts } from "../../../lib/career";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { localDate } from "../../../lib/time";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../components/ui";
import {
  addInterviewPrep,
  addPortfolioItem,
  createApplication,
  deleteApplication,
  deleteInterviewPrep,
  deletePortfolioItem,
  setApplicationStatus,
} from "./actions";

export default async function CareerPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "career");
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const [{ data: apps }, { data: prep }, { data: items }] = await Promise.all([
    supabase
      .from("job_applications")
      .select(
        "id, company, role, url, status, location, applied_on, deadline, contact_name, notes, revision",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("interview_prep")
      .select("id, application_id, category, question, answer, confidence, revision")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("portfolio_items")
      .select("id, kind, title, url, description, tags, revision")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const appList = apps ?? [];
  const today = localDate(new Date(), ctx.timezone);
  const soon = dueSoon(appList, today);
  const label = new Map(appList.map((a) => [a.id, `${a.company} · ${a.role}`]));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Career" subtitle="Private to you. Not shared with any workspace member." />
      <Flash error={error} message={message} />
      <p className="mb-6 text-sm">
        <a href="/career/profile" className="text-primary">
          Profile and CV entries
        </a>
        {" · "}
        <a href="/career/cv" className="text-primary">
          View printable CV
        </a>
      </p>

      <Card title="Applications" className="mb-6">
        <ul className="mb-4 flex flex-wrap gap-2 text-xs">
          {pipelineCounts(appList).map((c) => (
            <li key={c.status} className="rounded-full border border-border px-3 py-1">
              {c.status}: <span className="font-medium">{c.count}</span>
            </li>
          ))}
        </ul>
        {soon.length > 0 && (
          <p className="mb-4 rounded-md border border-border px-3 py-2 text-sm">
            Deadlines in the next 14 days:{" "}
            {soon.map((a) => `${a.company} (${a.deadline})`).join(", ")}
          </p>
        )}
        <form action={createApplication} className="grid gap-3 sm:grid-cols-6">
          <input
            name="company"
            required
            maxLength={200}
            placeholder="Company"
            aria-label="Company"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="role"
            required
            maxLength={200}
            placeholder="Role"
            aria-label="Role"
            className={`${inputClass} sm:col-span-2`}
          />
          <select
            name="status"
            defaultValue="wishlist"
            aria-label="Status"
            className={`${inputClass} sm:col-span-2`}
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="url"
            type="url"
            placeholder="Posting link (optional)"
            aria-label="Posting link"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="location"
            maxLength={120}
            placeholder="Location"
            aria-label="Location"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="deadline"
            type="date"
            aria-label="Deadline"
            className={`${inputClass} sm:col-span-2`}
          />
          <textarea
            name="notes"
            rows={2}
            maxLength={4000}
            placeholder="Notes"
            aria-label="Notes"
            className={`${inputClass} sm:col-span-6`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-6`}>
            Add application
          </button>
        </form>
      </Card>

      {appList.length ? (
        <ul className="mb-8 space-y-3">
          {appList.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {a.company} · {a.role}
                      </a>
                    ) : (
                      `${a.company} · ${a.role}`
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {a.status}
                    {a.location ? ` · ${a.location}` : ""}
                    {a.applied_on ? ` · applied ${a.applied_on}` : ""}
                    {a.deadline ? ` · deadline ${a.deadline}` : ""}
                  </p>
                  {a.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{a.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <form action={setApplicationStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="revision" value={a.revision} />
                    <input type="hidden" name="hasAppliedOn" value={a.applied_on ? "1" : "0"} />
                    <select
                      name="status"
                      defaultValue={a.status}
                      aria-label="Status"
                      className={`${inputClass} w-auto py-1 text-xs`}
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={subtleButton}>
                      Set
                    </button>
                  </form>
                  <form action={deleteApplication}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="revision" value={a.revision} />
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
        <div className="mb-8">
          <Empty>No applications yet.</Empty>
        </div>
      )}

      <Card title="Interview preparation" className="mb-6">
        <form action={addInterviewPrep} className="grid gap-3 sm:grid-cols-6">
          <input
            name="question"
            required
            maxLength={1000}
            placeholder="Question"
            aria-label="Question"
            className={`${inputClass} sm:col-span-6`}
          />
          <textarea
            name="answer"
            rows={3}
            maxLength={4000}
            placeholder="Your answer (situation, task, action, result)"
            aria-label="Answer"
            className={`${inputClass} sm:col-span-6`}
          />
          <select
            name="category"
            defaultValue="behavioural"
            aria-label="Category"
            className={`${inputClass} sm:col-span-2`}
          >
            {INTERVIEW_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            name="confidence"
            defaultValue="3"
            aria-label="Confidence"
            className={`${inputClass} sm:col-span-1`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Confidence {n}
              </option>
            ))}
          </select>
          <select
            name="applicationId"
            defaultValue=""
            aria-label="Application"
            className={`${inputClass} sm:col-span-3`}
          >
            <option value="">Any application</option>
            {appList.map((a) => (
              <option key={a.id} value={a.id}>
                {label.get(a.id)}
              </option>
            ))}
          </select>
          <button type="submit" className={`${primaryButton} sm:col-span-6`}>
            Add question
          </button>
        </form>
      </Card>
      {prep?.length ? (
        <ul className="mb-8 space-y-3">
          {prep.map((q) => (
            <li key={q.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{q.question}</p>
                  <p className="mt-1 text-xs text-muted">
                    {q.category} · confidence {q.confidence}/5
                    {q.application_id && label.get(q.application_id)
                      ? ` · ${label.get(q.application_id)}`
                      : ""}
                  </p>
                  {q.answer && <p className="mt-2 whitespace-pre-wrap text-sm">{q.answer}</p>}
                </div>
                <form action={deleteInterviewPrep}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="revision" value={q.revision} />
                  <button type="submit" className={subtleButton}>
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-8">
          <Empty>No interview questions yet.</Empty>
        </div>
      )}

      <Card title="Portfolio" className="mb-6">
        <form action={addPortfolioItem} className="grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Title"
            aria-label="Title"
            className={`${inputClass} sm:col-span-3`}
          />
          <select
            name="kind"
            defaultValue="project"
            aria-label="Kind"
            className={`${inputClass} sm:col-span-1`}
          >
            {PORTFOLIO_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            name="url"
            type="url"
            placeholder="Link (optional)"
            aria-label="Link"
            className={`${inputClass} sm:col-span-2`}
          />
          <textarea
            name="description"
            rows={2}
            maxLength={2000}
            placeholder="Description"
            aria-label="Description"
            className={`${inputClass} sm:col-span-6`}
          />
          <input
            name="tags"
            placeholder="Tags, comma separated"
            aria-label="Tags"
            className={`${inputClass} sm:col-span-4`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Add item
          </button>
        </form>
      </Card>
      {items?.length ? (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {i.url ? (
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {i.title}
                      </a>
                    ) : (
                      i.title
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {i.kind}
                    {i.tags.length ? ` · ${i.tags.join(", ")}` : ""}
                  </p>
                  {i.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{i.description}</p>
                  )}
                </div>
                <form action={deletePortfolioItem}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="revision" value={i.revision} />
                  <button type="submit" className={subtleButton}>
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No portfolio items yet.</Empty>
      )}
    </div>
  );
}
