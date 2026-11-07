import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { addDays, isValidMonth, localDate, monthGrid, shiftMonth } from "../../../lib/time";
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
import { createEvent, deleteEvent } from "./actions";

type Event = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  revision: number;
};
type DueTask = { id: string; title: string; due_at: string };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams & { m?: string }>;
}) {
  const ctx = await getAppContext();
  const sp = await searchParams;
  const today = localDate(new Date(), ctx.timezone);
  const month = isValidMonth(sp.m) ? sp.m : today.slice(0, 7);
  const grid = monthGrid(month);
  const first = grid[0]![0]!;
  const last = grid[grid.length - 1]![6]!;

  // Pad by a day each side so events near the edges in any time zone are included, then bucket by local date.
  const from = `${addDays(first, -1)}T00:00:00Z`;
  const to = `${addDays(last, 2)}T00:00:00Z`;
  const supabase = await createClient();
  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, location, starts_at, ends_at, revision")
      .eq("workspace_id", ctx.current.id)
      .is("deleted_at", null)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at"),
    supabase
      .from("tasks")
      .select("id, title, due_at")
      .eq("workspace_id", ctx.current.id)
      .is("deleted_at", null)
      .in("status", ["todo", "in_progress"])
      .gte("due_at", from)
      .lt("due_at", to),
  ]);

  const eventsByDay = new Map<string, Event[]>();
  for (const e of (events ?? []) as Event[]) {
    const d = localDate(e.starts_at, ctx.timezone);
    eventsByDay.set(d, [...(eventsByDay.get(d) ?? []), e]);
  }
  const tasksByDay = new Map<string, DueTask[]>();
  for (const t of (tasks ?? []) as DueTask[]) {
    const d = localDate(t.due_at, ctx.timezone);
    tasksByDay.set(d, [...(tasksByDay.get(d) ?? []), t]);
  }

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const time = new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: ctx.timezone });
  const monthEvents = ((events ?? []) as Event[]).filter((e) =>
    localDate(e.starts_at, ctx.timezone).startsWith(month),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Calendar"
        subtitle={`Times shown in ${ctx.timezone}. Open tasks appear on their due date.`}
      />
      <Flash error={sp.error} message={sp.message} />

      <Card className="mb-6">
        <form action={createEvent} className="grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={300}
            placeholder="Event title"
            aria-label="Event title"
            className={`${inputClass} sm:col-span-6`}
          />
          <label className="text-xs text-muted sm:col-span-2">
            Starts
            <input
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={`${today}T09:00`}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            Ends
            <input
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={`${today}T10:00`}
              className={`${inputClass} mt-1`}
            />
          </label>
          <input
            name="location"
            maxLength={200}
            placeholder="Location (optional)"
            aria-label="Location"
            className={`${inputClass} self-end sm:col-span-2`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-6`}>
            Add event
          </button>
        </form>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">{monthLabel}</h2>
        <div className="flex gap-2">
          <a href={`/calendar?m=${shiftMonth(month, -1)}`} className={subtleButton}>
            Previous
          </a>
          <a href="/calendar" className={subtleButton}>
            Today
          </a>
          <a href={`/calendar?m=${shiftMonth(month, 1)}`} className={subtleButton}>
            Next
          </a>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-lg border border-border bg-border text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-surface px-2 py-1.5 text-muted">
              {d}
            </div>
          ))}
          {grid.flat().map((day) => {
            const inMonth = day.startsWith(month);
            return (
              <div key={day} className={`min-h-24 bg-bg p-1.5 ${inMonth ? "" : "opacity-40"}`}>
                <p className={day === today ? "font-semibold text-primary" : "text-muted"}>
                  {Number(day.slice(8))}
                </p>
                {(eventsByDay.get(day) ?? []).slice(0, 3).map((e) => (
                  <p
                    key={e.id}
                    className="mt-1 truncate rounded bg-primary/20 px-1 py-0.5"
                    title={e.title}
                  >
                    {e.title}
                  </p>
                ))}
                {(tasksByDay.get(day) ?? []).slice(0, 2).map((t) => (
                  <p
                    key={t.id}
                    className="mt-1 truncate rounded bg-accent/20 px-1 py-0.5"
                    title={`Task: ${t.title}`}
                  >
                    ☐ {t.title}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-medium">Events this month</h2>
      {monthEvents.length ? (
        <ul className="space-y-2">
          {monthEvents.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{e.title}</p>
                <p className="text-xs text-muted">
                  {localDate(e.starts_at, ctx.timezone)} · {time.format(new Date(e.starts_at))}–
                  {time.format(new Date(e.ends_at))}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </div>
              <form action={deleteEvent}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="revision" value={e.revision} />
                <button type="submit" className={subtleButton}>
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No events this month.</Empty>
      )}
    </div>
  );
}
