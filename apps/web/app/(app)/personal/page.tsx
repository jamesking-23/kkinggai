import { DATE_KINDS } from "@kkingg/schemas";
import { requireModule } from "../../../lib/modules";
import { MOODS, upcoming } from "../../../lib/personal";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { localDate } from "../../../lib/time";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../components/ui";
import {
  addImportantDate,
  addJournalEntry,
  deleteImportantDate,
  deleteJournalEntry,
} from "./actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "personal");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const today = localDate(new Date(), ctx.timezone);

  const [{ data: entries }, { data: dates }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, entry_date, mood, body, tags, revision")
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(30),
    supabase
      .from("important_dates")
      .select("id, title, kind, month, day, year, notes, revision")
      .is("deleted_at", null),
  ]);
  const soon = upcoming(dates ?? [], today);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Personal"
        subtitle="Private to you. Not shared with any workspace member."
      />
      <Flash error={error} message={message} />

      <Card title="Important dates" className="mb-6">
        <form action={addImportantDate} className="mb-4 grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={160}
            placeholder="Title"
            aria-label="Title"
            className={`${inputClass} sm:col-span-3`}
          />
          <select
            name="kind"
            defaultValue="birthday"
            aria-label="Kind"
            className={`${inputClass} sm:col-span-3`}
          >
            {DATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            name="month"
            required
            aria-label="Month"
            className={`${inputClass} sm:col-span-2`}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            name="day"
            type="number"
            min={1}
            max={31}
            required
            placeholder="Day"
            aria-label="Day"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="year"
            type="number"
            min={1900}
            max={2200}
            placeholder="Year (optional)"
            aria-label="Year"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="notes"
            maxLength={1000}
            placeholder="Notes"
            aria-label="Notes"
            className={`${inputClass} sm:col-span-5`}
          />
          <button className={`${primaryButton} sm:col-span-1`}>Add</button>
        </form>
        {soon.length === 0 ? (
          <p className="text-sm text-muted">No dates yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {soon.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <span className="w-24 shrink-0 text-muted">
                  {d.daysAway === 0
                    ? "Today"
                    : d.daysAway === 1
                      ? "Tomorrow"
                      : `In ${d.daysAway} days`}
                </span>
                <span className="flex-1">
                  {d.title}{" "}
                  <span className="text-xs text-muted">
                    ({d.kind}, {d.date}
                    {d.turning !== null && d.turning > 0 ? `, ${d.turning}` : ""})
                  </span>
                  {d.notes && <span className="block text-xs text-muted">{d.notes}</span>}
                </span>
                <form action={deleteImportantDate}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="revision" value={d.revision} />
                  <button className={subtleButton}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Journal">
        <form action={addJournalEntry} className="mb-4 grid gap-3 sm:grid-cols-6">
          <input
            name="entryDate"
            type="date"
            required
            defaultValue={today}
            aria-label="Date"
            className={`${inputClass} sm:col-span-2`}
          />
          <select
            name="mood"
            defaultValue=""
            aria-label="Mood"
            className={`${inputClass} sm:col-span-2`}
          >
            <option value="">Mood (optional)</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} · {MOODS[n]}
              </option>
            ))}
          </select>
          <input
            name="tags"
            placeholder="Tags, comma separated"
            aria-label="Tags"
            className={`${inputClass} sm:col-span-2`}
          />
          <textarea
            name="body"
            required
            rows={4}
            maxLength={20000}
            placeholder="How was the day?"
            aria-label="Entry"
            className={`${inputClass} sm:col-span-6`}
          />
          <button className={`${primaryButton} sm:col-span-6`}>Save entry</button>
        </form>
        {(entries ?? []).length === 0 ? (
          <p className="text-sm text-muted">No entries yet. One entry per day.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(entries ?? []).map((e) => (
              <li key={e.id} className="py-3">
                <div className="mb-1 flex items-center gap-3">
                  <span className="font-medium">{e.entry_date}</span>
                  {e.mood && <span className="text-xs text-muted">{MOODS[e.mood]}</span>}
                  {e.tags.length > 0 && (
                    <span className="text-xs text-muted">
                      {e.tags.map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                  <form action={deleteJournalEntry} className="ml-auto">
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="revision" value={e.revision} />
                    <button className={subtleButton}>Remove</button>
                  </form>
                </div>
                <p className="whitespace-pre-wrap">{e.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
