import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { dailyStreak } from "../../../lib/productivity";
import { addDays, localDate } from "../../../lib/time";
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
import { archiveHabit, createHabit, logHabitToday, undoHabitToday } from "./actions";

type Habit = { id: string; name: string; cadence: string; target_per_period: number };

export default async function HabitsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const ctx = await getAppContext();
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const today = localDate(new Date(), ctx.timezone);
  const since = addDays(today, -60);

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase
      .from("habits")
      .select("id, name, cadence, target_per_period")
      .eq("workspace_id", ctx.current.id)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("habit_logs")
      .select("habit_id, log_date")
      .eq("workspace_id", ctx.current.id)
      .gte("log_date", since),
  ]);
  const byHabit = new Map<string, string[]>();
  for (const l of (logs ?? []) as { habit_id: string; log_date: string }[]) {
    byHabit.set(l.habit_id, [...(byHabit.get(l.habit_id) ?? []), l.log_date]);
  }
  const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Habits" subtitle="Habits are private to you, even in shared workspaces." />
      <Flash error={error} message={message} />

      <Card className="mb-6">
        <form action={createHabit} className="grid gap-3 sm:grid-cols-6">
          <input
            name="name"
            required
            maxLength={200}
            placeholder="New habit, e.g. Morning run"
            aria-label="Habit name"
            className={`${inputClass} sm:col-span-3`}
          />
          <select name="cadence" aria-label="Cadence" className={`${inputClass} sm:col-span-1`}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <input
            name="targetPerPeriod"
            type="number"
            min="1"
            max="14"
            defaultValue="1"
            aria-label="Target per period"
            className={`${inputClass} sm:col-span-1`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-1`}>
            Add
          </button>
        </form>
      </Card>

      {(habits as Habit[] | null)?.length ? (
        <ul className="space-y-3">
          {(habits as Habit[]).map((h) => {
            const dates = byHabit.get(h.id) ?? [];
            const doneToday = dates.includes(today);
            const thisWeek = dates.filter((d) => d >= weekStart && d <= today).length;
            return (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {h.cadence === "daily" ? `Streak ${dailyStreak(dates, today)} day(s) · ` : ""}
                    This week {thisWeek}
                    {h.cadence === "weekly" ? ` of ${h.target_per_period}` : " of 7"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={doneToday ? undoHabitToday : logHabitToday}>
                    <input type="hidden" name="habitId" value={h.id} />
                    <button type="submit" className={doneToday ? subtleButton : primaryButton}>
                      {doneToday ? "Undo today" : "Done today"}
                    </button>
                  </form>
                  <form action={archiveHabit}>
                    <input type="hidden" name="habitId" value={h.id} />
                    <button type="submit" className={subtleButton}>
                      Archive
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No habits yet.</Empty>
      )}
    </div>
  );
}
