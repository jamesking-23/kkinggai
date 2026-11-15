import { dayDiff, GOALS, type Goal } from "./plan";
import {
  formatDuration,
  formatPace,
  KIND_LABELS,
  localDate,
  paceSecPerKm,
  summariseRuns,
  weekStart,
} from "./running";

/** Only these fields are ever sent to the AI provider. Names, notes and GPS routes are deliberately not here. */
export type CoachRun = {
  started_at: string;
  kind: string;
  distance_m: number;
  moving_seconds: number;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  effort: number | null;
};
export type CoachSession = { planned_on: string; kind: string; distance_m: number; status: string };
export type CoachPlan = { goal: string; race_date: string; weeks: number; days_per_week: number };

export const COACH_SYSTEM_PROMPT =
  "You are a running coach inside KKINGG AI, a private personal app. Use only the training data given below; if something you " +
  "need is missing, say so instead of guessing. Give practical, specific suggestions in plain language, under about 250 words. " +
  "You are not a doctor: if the user mentions pain, injury, dizziness, chest symptoms or illness, tell them to stop running and " +
  "see a qualified professional. Do not invent paces, heart-rate zones or physiology the data does not support. " +
  "You cannot change their plan or data; you can only advise.";

const km = (m: number) => (m / 1000).toFixed(1);

/** Builds the data block for the coach prompt. Pure; picks fields explicitly so extra properties never leak. */
export function buildCoachContext(input: {
  runs: CoachRun[];
  plan: CoachPlan | null;
  sessions: CoachSession[];
  now: Date;
  timeZone: string;
  maxRuns?: number;
}): string {
  const { plan, now, timeZone } = input;
  const runs = input.runs.map((r) => ({
    started_at: r.started_at,
    kind: r.kind,
    distance_m: r.distance_m,
    moving_seconds: r.moving_seconds,
    elevation_gain_m: r.elevation_gain_m,
    avg_hr: r.avg_hr,
    effort: r.effort,
  }));
  const today = localDate(now.toISOString(), timeZone);
  const lines: string[] = [`Today: ${today}. Weeks start on Monday.`];

  const sum = summariseRuns(runs, now, timeZone, 8);
  lines.push("", "Weekly totals, oldest first (week starting: km, runs):");
  for (const w of sum.weeks)
    lines.push(`${w.weekStart}: ${km(w.distanceM)} km, ${w.runs} run${w.runs === 1 ? "" : "s"}`);

  const recent = [...runs]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, input.maxRuns ?? 15);
  lines.push(
    "",
    "Recent runs, newest first (date | type | km | time | pace | climb | avg HR | effort 1-10):",
  );
  if (recent.length === 0) lines.push("No runs logged in this period.");
  for (const r of recent) {
    lines.push(
      [
        localDate(r.started_at, timeZone),
        KIND_LABELS[r.kind] ?? r.kind,
        km(r.distance_m),
        formatDuration(r.moving_seconds),
        formatPace(paceSecPerKm(r.distance_m, r.moving_seconds)),
        r.elevation_gain_m === null ? "-" : `${r.elevation_gain_m} m`,
        r.avg_hr ?? "-",
        r.effort ?? "-",
      ].join(" | "),
    );
  }

  if (plan) {
    const g = GOALS[plan.goal as Goal];
    const days = dayDiff(plan.race_date, today);
    lines.push(
      "",
      `Training plan: ${g?.label ?? plan.goal} on ${plan.race_date} (${days >= 0 ? `${days} days away` : "date has passed"}), ${plan.days_per_week} runs a week, ${plan.weeks} weeks.`,
    );
    const thisWeek = weekStart(today);
    const nextWeekEnd = new Date(`${thisWeek}T00:00:00Z`);
    nextWeekEnd.setUTCDate(nextWeekEnd.getUTCDate() + 13);
    const end = nextWeekEnd.toISOString().slice(0, 10);
    const near = input.sessions
      .filter((s) => s.planned_on >= thisWeek && s.planned_on <= end)
      .sort((a, b) => a.planned_on.localeCompare(b.planned_on));
    lines.push("Planned sessions this week and next (date | type | km | status):");
    if (near.length === 0) lines.push("None.");
    for (const s of near)
      lines.push(
        `${s.planned_on} | ${KIND_LABELS[s.kind] ?? s.kind} | ${km(s.distance_m)} | ${s.status}`,
      );
  } else {
    lines.push("", "No active training plan.");
  }
  return lines.join("\n");
}
