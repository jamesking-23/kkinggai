import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { goalProgress } from "../../../lib/productivity";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  ProgressBar,
  subtleButton,
} from "../../../components/ui";
import type { FlashParams } from "../../../lib/form";
import { createGoal, setGoalStatus, updateGoalProgress } from "./actions";

type Goal = {
  id: string;
  title: string;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  status: string;
  revision: number;
};

export default async function GoalsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const ctx = await getAppContext();
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("id, title, target_value, current_value, unit, deadline, status, revision")
    .eq("workspace_id", ctx.current.id)
    .order("created_at", { ascending: false });
  const goals = (data ?? []) as Goal[];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Goals" subtitle="Set a measurable target and track real progress." />
      <Flash error={error} message={message} />

      <Card className="mb-6">
        <form action={createGoal} className="grid gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Goal, e.g. Run 500 km this year"
            aria-label="Goal title"
            className={`${inputClass} sm:col-span-6`}
          />
          <input
            name="targetValue"
            type="number"
            step="any"
            min="0"
            placeholder="Target (optional)"
            aria-label="Target value"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="unit"
            maxLength={30}
            placeholder="Unit, e.g. km"
            aria-label="Unit"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="deadline"
            type="date"
            aria-label="Deadline"
            className={`${inputClass} sm:col-span-2`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-6`}>
            Add goal
          </button>
        </form>
      </Card>

      {goals.length ? (
        <ul className="space-y-3">
          {goals.map((g) => {
            const pct = goalProgress(
              Number(g.current_value),
              g.target_value === null ? null : Number(g.target_value),
            );
            return (
              <li key={g.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{g.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {g.status}
                      {g.deadline ? ` · by ${g.deadline}` : ""}
                      {pct !== null
                        ? ` · ${g.current_value} of ${g.target_value}${g.unit ? ` ${g.unit}` : ""} (${pct}%)`
                        : ""}
                    </p>
                  </div>
                  {g.status === "active" && (
                    <form action={setGoalStatus} className="flex gap-2">
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="revision" value={g.revision} />
                      <button name="status" value="achieved" className={subtleButton}>
                        Achieved
                      </button>
                      <button name="status" value="abandoned" className={subtleButton}>
                        Abandon
                      </button>
                    </form>
                  )}
                </div>
                {pct !== null && (
                  <div className="mt-3">
                    <ProgressBar percent={pct} />
                  </div>
                )}
                {g.status === "active" && (
                  <form action={updateGoalProgress} className="mt-3 flex gap-2">
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="revision" value={g.revision} />
                    <input
                      name="currentValue"
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={g.current_value}
                      aria-label="Current progress"
                      className={`${inputClass} max-w-40`}
                    />
                    <button type="submit" className={subtleButton}>
                      Update progress
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No goals yet.</Empty>
      )}
    </div>
  );
}
