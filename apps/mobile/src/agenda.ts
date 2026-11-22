// Calendar agenda helpers: bucket events and due tasks by local calendar day in the user's timezone. Pure, no network.

export type AgendaEvent = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
};
export type AgendaTask = { id: string; title: string; due_at: string };
export type AgendaItem = {
  key: string;
  kind: "event" | "task";
  title: string;
  at: string; // ISO
  detail: string | null;
};
export type AgendaDay = { date: string; items: AgendaItem[] };

/** Falls back to UTC for a missing or unknown timezone name. */
export function safeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** YYYY-MM-DD of an instant in a timezone; "" for an invalid date. */
export function localDate(iso: string, tz: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(t));
  const g = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** "09:30" of an instant in a timezone; "" for an invalid date. */
export function localTime(iso: string, tz: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeZone(tz),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const g = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${g("hour")}:${g("minute")}`;
}

/** "Today", "Tomorrow", or e.g. "Wed 25 Nov" for a YYYY-MM-DD relative to today's YYYY-MM-DD. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  const d = Date.parse(`${date}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(d) || !Number.isFinite(t)) return date;
  if (d - t === 86_400_000) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(d));
}

/** Days from today onward (never earlier), each with its events then tasks in time order. Empty days are omitted. */
export function buildAgenda(
  events: AgendaEvent[],
  tasks: AgendaTask[],
  tz: string,
  now: Date = new Date(),
): AgendaDay[] {
  const today = localDate(now.toISOString(), tz);
  const byDay = new Map<string, AgendaItem[]>();
  const add = (date: string, item: AgendaItem) => {
    if (!date || date < today) return;
    byDay.set(date, [...(byDay.get(date) ?? []), item]);
  };
  for (const e of events) {
    const start = localTime(e.starts_at, tz);
    const end = localTime(e.ends_at, tz);
    add(localDate(e.starts_at, tz), {
      key: `e-${e.id}`,
      kind: "event",
      title: e.title,
      at: e.starts_at,
      detail:
        [start && end ? `${start}–${end}` : start, e.location].filter(Boolean).join(" · ") || null,
    });
  }
  for (const t of tasks) {
    add(localDate(t.due_at, tz), {
      key: `t-${t.id}`,
      kind: "task",
      title: t.title,
      at: t.due_at,
      detail: `Due ${localTime(t.due_at, tz)}`,
    });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, items]) => ({
      date,
      items: items.sort(
        (x, y) => Date.parse(x.at) - Date.parse(y.at) || (x.kind === "event" ? -1 : 1),
      ),
    }));
}
