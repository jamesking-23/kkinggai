import { ASSIGNMENT_STATUSES, COURSE_STATUSES } from "@kkingg/schemas";
import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
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
  createAssignment,
  createCourse,
  createStudyNote,
  deleteAssignment,
  deleteCourse,
  deleteStudyNote,
  setCourseStatus,
  updateAssignment,
} from "./actions";

export default async function AcademicsPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "academics");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const ws = ctx.current.id;

  const [{ data: courses }, { data: assignments }, { data: notes }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, code, name, term, instructor, credits, status, revision")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("id, course_id, title, due_at, status, score, max_score, weight_percent, revision")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("study_notes")
      .select("id, title, body, course_id, tags, revision, updated_at")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);
  const courseList = courses ?? [];
  const courseName = new Map(
    courseList.map((c) => [c.id, c.code ? `${c.code} · ${c.name}` : c.name]),
  );
  const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: ctx.timezone });
  const now = Date.now();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Academics" subtitle="Courses, assignments and study notes." />
      <Flash error={error} message={message} />

      <Card title="Add a course" className="mb-6">
        <form action={createCourse} className="grid gap-3 sm:grid-cols-6">
          <input
            name="name"
            required
            maxLength={200}
            placeholder="Course name"
            aria-label="Course name"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="code"
            maxLength={30}
            placeholder="Code, e.g. CE301"
            aria-label="Course code"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="term"
            maxLength={60}
            placeholder="Term"
            aria-label="Term"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="credits"
            type="number"
            step="0.5"
            min="0"
            placeholder="Credits"
            aria-label="Credits"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="instructor"
            maxLength={120}
            placeholder="Instructor (optional)"
            aria-label="Instructor"
            className={`${inputClass} sm:col-span-4`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Add course
          </button>
        </form>
      </Card>

      {courseList.length ? (
        <ul className="mb-8 space-y-4">
          {courseList.map((c) => {
            const mine = (assignments ?? []).filter((a) => a.course_id === c.id);
            const graded = mine.filter((a) => a.status === "graded" && a.score !== null);
            const pct = graded.length
              ? Math.round(
                  (graded.reduce((s, a) => s + Number(a.score), 0) /
                    graded.reduce((s, a) => s + Number(a.max_score), 0)) *
                    100,
                )
              : null;
            return (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{c.code ? `${c.code} · ${c.name}` : c.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {c.status}
                      {c.term ? ` · ${c.term}` : ""}
                      {c.instructor ? ` · ${c.instructor}` : ""}
                      {c.credits !== null ? ` · ${c.credits} credits` : ""}
                      {pct !== null
                        ? ` · graded work: ${pct}% (${graded.length} item${graded.length === 1 ? "" : "s"})`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={setCourseStatus} className="flex gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="revision" value={c.revision} />
                      <select
                        name="status"
                        defaultValue={c.status}
                        aria-label="Course status"
                        className={`${inputClass} w-auto py-1 text-xs`}
                      >
                        {COURSE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={subtleButton}>
                        Set
                      </button>
                    </form>
                    <form action={deleteCourse}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="revision" value={c.revision} />
                      <button type="submit" className={subtleButton}>
                        Remove
                      </button>
                    </form>
                  </div>
                </div>

                {mine.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {mine.map((a) => {
                      const late =
                        a.due_at &&
                        new Date(a.due_at).getTime() < now &&
                        (a.status === "todo" || a.status === "in_progress");
                      return (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {a.title}
                            <span className={`text-xs ${late ? "text-danger" : "text-muted"}`}>
                              {a.due_at
                                ? ` · due ${fmt.format(new Date(a.due_at))}${late ? " (overdue)" : ""}`
                                : ""}
                              {a.weight_percent !== null ? ` · ${a.weight_percent}% of grade` : ""}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <form action={updateAssignment} className="flex items-center gap-2">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="revision" value={a.revision} />
                              <input type="hidden" name="maxScore" value={a.max_score} />
                              <select
                                name="status"
                                defaultValue={a.status}
                                aria-label="Assignment status"
                                className={`${inputClass} w-auto py-1 text-xs`}
                              >
                                {ASSIGNMENT_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <input
                                name="score"
                                type="number"
                                step="any"
                                min="0"
                                defaultValue={a.score ?? ""}
                                placeholder={`/ ${a.max_score}`}
                                aria-label="Score"
                                className={`${inputClass} w-20 py-1 text-xs`}
                              />
                              <button type="submit" className={subtleButton}>
                                Save
                              </button>
                            </form>
                            <form action={deleteAssignment}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="revision" value={a.revision} />
                              <button type="submit" className={subtleButton}>
                                Remove
                              </button>
                            </form>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <form action={createAssignment} className="mt-3 grid gap-2 sm:grid-cols-6">
                  <input type="hidden" name="courseId" value={c.id} />
                  <input
                    name="title"
                    required
                    maxLength={300}
                    placeholder="Add an assignment"
                    aria-label="Assignment title"
                    className={`${inputClass} sm:col-span-3`}
                  />
                  <input
                    name="dueDate"
                    type="date"
                    aria-label="Due date"
                    className={`${inputClass} sm:col-span-1`}
                  />
                  <input
                    name="maxScore"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Max 100"
                    aria-label="Maximum score"
                    className={`${inputClass} sm:col-span-1`}
                  />
                  <button type="submit" className={subtleButton}>
                    Add
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mb-8">
          <Empty>No courses yet.</Empty>
        </div>
      )}

      <h2 className="mb-3 text-lg font-medium">Study notes</h2>
      <Card className="mb-4">
        <form action={createStudyNote} className="grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Title"
            aria-label="Note title"
            className={`${inputClass} sm:col-span-4`}
          />
          <select
            name="courseId"
            defaultValue=""
            aria-label="Course"
            className={`${inputClass} sm:col-span-2`}
          >
            <option value="">No course</option>
            {courseList.map((c) => (
              <option key={c.id} value={c.id}>
                {courseName.get(c.id)}
              </option>
            ))}
          </select>
          <textarea
            name="body"
            rows={4}
            maxLength={50000}
            placeholder="Notes"
            aria-label="Note text"
            className={`${inputClass} sm:col-span-6`}
          />
          <input
            name="tags"
            placeholder="Tags, comma separated"
            aria-label="Tags"
            className={`${inputClass} sm:col-span-4`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Save note
          </button>
        </form>
      </Card>
      {notes?.length ? (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {n.course_id && courseName.get(n.course_id)
                      ? `${courseName.get(n.course_id)} · `
                      : ""}
                    {fmt.format(new Date(n.updated_at))}
                    {n.tags.length ? ` · ${n.tags.join(", ")}` : ""}
                  </p>
                  {n.body && <p className="mt-2 whitespace-pre-wrap text-sm">{n.body}</p>}
                </div>
                <form action={deleteStudyNote}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="revision" value={n.revision} />
                  <button type="submit" className={subtleButton}>
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No notes yet.</Empty>
      )}
    </div>
  );
}
