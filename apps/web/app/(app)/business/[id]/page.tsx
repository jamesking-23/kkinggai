import { notFound } from "next/navigation";
import { CONTACT_ROLES, VENTURE_TASK_STATUSES } from "@kkingg/schemas";
import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { localDate } from "../../../../lib/time";
import type { FlashParams } from "../../../../lib/form";
import {
  Card,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { addContact, addTask, deleteContact, deleteTask, setTaskStatus } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VenturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "business");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const { data: venture } = await supabase
    .from("ventures")
    .select("id, name, stage")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!venture) notFound();

  const [{ data: tasks }, { data: contacts }] = await Promise.all([
    supabase
      .from("venture_tasks")
      .select("id, title, status, due_on, notes, revision")
      .eq("venture_id", id)
      .is("deleted_at", null)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("venture_contacts")
      .select("id, name, role, email, phone, notes, revision")
      .eq("venture_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const today = localDate(new Date(), ctx.timezone);
  const open = (tasks ?? []).filter((t) => t.status !== "done");
  const done = (tasks ?? []).filter((t) => t.status === "done");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={venture.name} subtitle={`Stage: ${venture.stage}. Private to you.`} />
      <Flash error={error} message={message} />
      <p className="mb-6 text-sm">
        <a href="/business" className="text-primary">
          Back to Business
        </a>
      </p>

      <Card title="Tasks" className="mb-6">
        <form action={addTask} className="mb-4 grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="ventureId" value={id} />
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Task"
            aria-label="Task"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="dueOn"
            type="date"
            aria-label="Due date"
            className={`${inputClass} sm:col-span-2`}
          />
          <button className={`${primaryButton} sm:col-span-1`}>Add</button>
        </form>
        {open.length === 0 && done.length === 0 ? (
          <p className="text-sm text-muted">No tasks yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {[...open, ...done].map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className={`flex-1 ${t.status === "done" ? "text-muted line-through" : ""}`}>
                  {t.title}
                  {t.due_on && (
                    <span
                      className={`ml-2 text-xs ${
                        t.status !== "done" && t.due_on < today ? "text-danger" : "text-muted"
                      }`}
                    >
                      due {t.due_on}
                    </span>
                  )}
                </span>
                <form action={setTaskStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="ventureId" value={id} />
                  <input type="hidden" name="revision" value={t.revision} />
                  <select
                    name="status"
                    defaultValue={t.status}
                    aria-label="Status"
                    className={inputClass}
                  >
                    {VENTURE_TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button className={subtleButton}>Set</button>
                </form>
                <form action={deleteTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="ventureId" value={id} />
                  <input type="hidden" name="revision" value={t.revision} />
                  <button className={subtleButton}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Contacts">
        <form action={addContact} className="mb-4 grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="ventureId" value={id} />
          <input
            name="name"
            required
            maxLength={120}
            placeholder="Name"
            aria-label="Name"
            className={`${inputClass} sm:col-span-2`}
          />
          <select
            name="role"
            defaultValue="other"
            aria-label="Role"
            className={`${inputClass} sm:col-span-2`}
          >
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            name="phone"
            maxLength={40}
            placeholder="Phone"
            aria-label="Phone"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="email"
            type="email"
            maxLength={200}
            placeholder="Email"
            aria-label="Email"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="notes"
            maxLength={2000}
            placeholder="Notes"
            aria-label="Notes"
            className={`${inputClass} sm:col-span-2`}
          />
          <button className={`${primaryButton} sm:col-span-1`}>Add</button>
        </form>
        {(contacts ?? []).length === 0 ? (
          <p className="text-sm text-muted">No contacts yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(contacts ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="flex-1">
                  <span className="font-medium">{c.name}</span>{" "}
                  <span className="text-xs text-muted">({c.role})</span>
                  {c.phone && <span className="ml-2 text-muted">{c.phone}</span>}
                  {c.email && <span className="ml-2 text-muted">{c.email}</span>}
                  {c.notes && <span className="block text-xs text-muted">{c.notes}</span>}
                </span>
                <form action={deleteContact}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="ventureId" value={id} />
                  <input type="hidden" name="revision" value={c.revision} />
                  <button className={subtleButton}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
