/**
 * Rule-based running plan generator. No AI is involved: the plan is a deterministic function of the inputs.
 * It is a generic progression (gradual build, a lighter week every 4th week, a taper), not personalised coaching.
 */

export type Goal = "5k" | "10k" | "half" | "marathon";
export type SessionKind = "easy" | "long" | "tempo" | "intervals" | "race";

export const GOALS: Record<
  Goal,
  {
    label: string;
    km: number;
    peakMin: number;
    peakMax: number;
    longMax: number;
    taperWeeks: number;
  }
> = {
  "5k": { label: "5 km", km: 5, peakMin: 20, peakMax: 40, longMax: 12, taperWeeks: 1 },
  "10k": { label: "10 km", km: 10, peakMin: 28, peakMax: 55, longMax: 18, taperWeeks: 1 },
  half: {
    label: "Half marathon",
    km: 21.0975,
    peakMin: 40,
    peakMax: 70,
    longMax: 24,
    taperWeeks: 2,
  },
  marathon: { label: "Marathon", km: 42.195, peakMin: 55, peakMax: 90, longMax: 32, taperWeeks: 3 },
};

export const MIN_WEEKS = 4;
export const MAX_WEEKS = 24;
const GROWTH = 1.08; // weekly build, well inside the common "no more than ~10%" guideline
const MIN_BASE_KM = 8;

export type PlanInput = {
  goal: Goal;
  raceDate: string; // yyyy-mm-dd
  today: string; // yyyy-mm-dd
  daysPerWeek: number; // 3..6
  currentWeeklyKm: number;
};

export type PlanSession = {
  week: number; // 1-based
  date: string;
  kind: SessionKind;
  distanceM: number;
  description: string;
};

export type GeneratedPlan = {
  sessions: PlanSession[];
  weeks: number;
  weekKm: number[];
  peakKm: number;
  warnings: string[];
};

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) =>
  new Date(toMs(d) + n * DAY_MS).toISOString().slice(0, 10);
export const dayDiff = (a: string, b: string) => Math.round((toMs(a) - toMs(b)) / DAY_MS);
const dow = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const valid = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !Number.isNaN(toMs(d)) &&
  new Date(toMs(d)).toISOString().slice(0, 10) === d;

type Slot = [dayOffset: number, role: "easy" | "quality" | "long"];
const TEMPLATES: Record<number, Slot[]> = {
  3: [
    [1, "quality"],
    [3, "easy"],
    [6, "long"],
  ],
  4: [
    [1, "quality"],
    [3, "easy"],
    [5, "easy"],
    [6, "long"],
  ],
  5: [
    [0, "easy"],
    [1, "quality"],
    [3, "easy"],
    [5, "easy"],
    [6, "long"],
  ],
  6: [
    [0, "easy"],
    [1, "quality"],
    [2, "easy"],
    [3, "easy"],
    [5, "easy"],
    [6, "long"],
  ],
};

const TAPER_FACTORS: Record<number, number[]> = { 1: [0.6], 2: [0.8, 0.55], 3: [0.85, 0.7, 0.5] };

/** Planned non-race running volume per week in km, plus which weeks are recovery weeks. */
export function weeklyVolumes(
  goal: Goal,
  weeks: number,
  currentWeeklyKm: number,
): { km: number[]; recovery: boolean[]; peakKm: number; warnings: string[] } {
  const g = GOALS[goal];
  const warnings: string[] = [];
  const buildWeeks = weeks - g.taperWeeks;
  let base = Math.max(currentWeeklyKm, MIN_BASE_KM);
  if (currentWeeklyKm < MIN_BASE_KM)
    warnings.push(`The plan starts from ${MIN_BASE_KM} km a week at least.`);
  base = Math.min(base, g.peakMax);

  const km: number[] = [];
  const recovery: boolean[] = [];
  for (let i = 1; i <= buildWeeks; i++) {
    if (i === 1) {
      km.push(base);
      recovery.push(false);
    } else if (i % 4 === 0 && i < buildWeeks) {
      km.push(base * 0.8);
      recovery.push(true);
    } else {
      base = Math.min(base * GROWTH, g.peakMax);
      km.push(base);
      recovery.push(false);
    }
  }
  const peak = Math.max(...km);
  for (const f of TAPER_FACTORS[g.taperWeeks]!) {
    km.push(peak * f);
    recovery.push(true);
  }
  if (peak < g.peakMin)
    warnings.push(
      `Your current volume and the time available only build to about ${Math.round(peak)} km a week, below the ${g.peakMin} km this plan would normally reach for a ${g.label.toLowerCase()}. Consider a later race date.`,
    );
  return { km, recovery, peakKm: peak, warnings };
}

const round05 = (x: number) => Math.round(x * 2) / 2;

function describe(kind: SessionKind, progress: number, goal: Goal): string {
  switch (kind) {
    case "easy":
      return "Easy run at a conversational pace.";
    case "long":
      return `Long run at an easy pace. Walk breaks are fine.${goal === "half" || goal === "marathon" ? " Practise fuelling and drinking on runs over 90 minutes." : ""}`;
    case "tempo":
      return `10 min easy, ${Math.round(15 + 20 * progress)} min at tempo effort (comfortably hard, only short phrases possible), 10 min easy.`;
    case "intervals":
      return `10 min easy, ${Math.round(4 + 4 * progress)} x 3 min hard (about 5 km race effort) with 2 min easy jog between, 10 min easy.`;
    case "race":
      return "Race day: start controlled, settle into goal effort, finish strong. Eat and drink as you practised.";
  }
}

export function generatePlan(input: PlanInput): GeneratedPlan | { error: string } {
  const { goal, raceDate, today, daysPerWeek, currentWeeklyKm } = input;
  if (!valid(raceDate) || !valid(today)) return { error: "Use valid dates." };
  if (!(goal in GOALS)) return { error: "Choose a goal." };
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 3 || daysPerWeek > 6)
    return { error: "Choose 3 to 6 running days a week." };
  if (!Number.isFinite(currentWeeklyKm) || currentWeeklyKm < 0 || currentWeeklyKm > 250)
    return { error: "Enter your current weekly distance in km." };
  if (dayDiff(raceDate, today) <= 0) return { error: "The race date must be in the future." };

  const monday1 = addDays(today, -dow(today));
  const weeks = Math.floor(dayDiff(raceDate, monday1) / 7) + 1;
  if (weeks < MIN_WEEKS)
    return { error: `The race is too close: a plan needs at least ${MIN_WEEKS} weeks.` };
  if (weeks > MAX_WEEKS)
    return { error: `Plans cover up to ${MAX_WEEKS} weeks. Pick a nearer race date.` };

  const g = GOALS[goal];
  const { km, recovery, peakKm, warnings } = weeklyVolumes(goal, weeks, currentWeeklyKm);
  const template = TEMPLATES[daysPerWeek]!;
  const buildWeeks = weeks - g.taperWeeks;
  const sessions: PlanSession[] = [];
  let qualityCount = 0;

  for (let w = 1; w <= weeks; w++) {
    const weekStart = addDays(monday1, (w - 1) * 7);
    const raceHere = dayDiff(raceDate, weekStart) >= 0 && dayDiff(raceDate, weekStart) <= 6;
    // Race week: only days at least two before the race (a rest day before it). Other weeks: the whole week.
    const limit = raceHere ? dayDiff(raceDate, weekStart) - 1 : 7;
    const progress =
      w <= buildWeeks && !recovery[w - 1]
        ? buildWeeks > 1
          ? (w - 1) / (buildWeeks - 1)
          : 0
        : w > buildWeeks
          ? 0.3
          : 0;

    const slots = template.filter(([off]) => off < limit);
    const easyCount = slots.filter((s) => s[1] === "easy").length;
    const hasLong = slots.some((s) => s[1] === "long");
    const hasQuality = slots.some((s) => s[1] === "quality") && !raceHere;
    const V = km[w - 1]!;
    const longKm = hasLong ? Math.min(V * (daysPerWeek === 3 ? 0.4 : 0.33), g.longMax) : 0;
    const qualKm = hasQuality ? Math.max(3, V * 0.2) : 0;
    const easyKm =
      easyCount + (hasQuality ? 0 : slots.filter((s) => s[1] === "quality").length) > 0
        ? Math.max(
            2,
            (V - longKm - qualKm) /
              (easyCount + (hasQuality ? 0 : slots.filter((s) => s[1] === "quality").length)),
          )
        : 0;
    if (hasQuality) qualityCount++;

    for (const [off, role] of slots) {
      const date = addDays(weekStart, off);
      if (dayDiff(date, today) < 0) continue;
      let kind: SessionKind;
      let dist: number;
      if (role === "long") {
        kind = "long";
        dist = Math.max(2, round05(longKm));
      } else if (role === "quality" && hasQuality) {
        kind = qualityCount % 2 === 1 ? "tempo" : "intervals";
        dist = Math.max(3, round05(qualKm));
      } else {
        kind = "easy";
        dist = Math.max(2, round05(easyKm));
      }
      sessions.push({
        week: w,
        date,
        kind,
        distanceM: Math.round(dist * 1000),
        description: describe(kind, progress, goal),
      });
    }
    if (raceHere) {
      sessions.push({
        week: w,
        date: raceDate,
        kind: "race",
        distanceM: Math.round(g.km * 1000),
        description: describe("race", 0, goal),
      });
    }
  }
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return {
    sessions,
    weeks,
    weekKm: km.map((v) => Math.round(v * 10) / 10),
    peakKm: Math.round(peakKm * 10) / 10,
    warnings,
  };
}
