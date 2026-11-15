import { describe, expect, it } from "vitest";
import { addDays, dayDiff, generatePlan, GOALS, weeklyVolumes, type GeneratedPlan } from "./plan";

const TODAY = "2026-11-16"; // Monday
const ok = (p: ReturnType<typeof generatePlan>): GeneratedPlan => {
  if ("error" in p) throw new Error(p.error);
  return p;
};

describe("validation", () => {
  it("rejects bad inputs", () => {
    const base = {
      goal: "10k" as const,
      raceDate: "2027-02-14",
      today: TODAY,
      daysPerWeek: 4,
      currentWeeklyKm: 25,
    };
    expect(generatePlan({ ...base, raceDate: "2026-11-10" })).toEqual({
      error: expect.stringContaining("future"),
    });
    expect(generatePlan({ ...base, raceDate: "2026-12-06" })).toEqual({
      error: expect.stringContaining("too close"),
    });
    expect(generatePlan({ ...base, raceDate: "2027-09-01" })).toEqual({
      error: expect.stringContaining("up to 24"),
    });
    expect(generatePlan({ ...base, daysPerWeek: 7 })).toEqual({
      error: expect.stringContaining("3 to 6"),
    });
    expect(generatePlan({ ...base, currentWeeklyKm: -1 })).toEqual({
      error: expect.stringContaining("weekly distance"),
    });
    expect(generatePlan({ ...base, raceDate: "2027-02-30" })).toEqual({
      error: "Use valid dates.",
    });
  });
});

describe("weeklyVolumes", () => {
  it("builds gradually, with recovery weeks and a taper", () => {
    const v = weeklyVolumes("half", 14, 30);
    const build = v.km.slice(0, 12);
    expect(
      v.recovery
        .slice(0, 12)
        .map((r, i) => (r ? i + 1 : 0))
        .filter(Boolean),
    ).toEqual([4, 8]);
    for (let i = 1; i < build.length; i++) {
      if (v.recovery[i] || v.recovery[i - 1]) continue;
      expect(build[i]! / build[i - 1]!).toBeLessThanOrEqual(1.0801);
    }
    expect(Math.max(...v.km)).toBeLessThanOrEqual(GOALS.half.peakMax);
    expect(v.km[12]!).toBeLessThan(v.peakKm);
    expect(v.km[13]!).toBeLessThan(v.km[12]!);
  });
  it("warns when the build cannot reach a sensible peak", () => {
    expect(weeklyVolumes("marathon", 8, 10).warnings.join(" ")).toContain(
      "Consider a later race date",
    );
    expect(weeklyVolumes("5k", 6, 3).warnings.join(" ")).toContain("at least");
  });
  it("never exceeds the goal's cap, even for someone already above it", () => {
    expect(Math.max(...weeklyVolumes("5k", 8, 100).km)).toBeLessThanOrEqual(GOALS["5k"].peakMax);
  });
});

describe("generatePlan", () => {
  const plan = ok(
    generatePlan({
      goal: "half",
      raceDate: "2027-02-14",
      today: TODAY,
      daysPerWeek: 4,
      currentWeeklyKm: 25,
    }),
  );
  it("ends with the race on the race date at the goal distance", () => {
    const last = plan.sessions.at(-1)!;
    expect(last).toMatchObject({ date: "2027-02-14", kind: "race", distanceM: 21098 });
    expect(plan.sessions.filter((s) => s.kind === "race")).toHaveLength(1);
    expect(plan.sessions.every((s) => s.date <= "2027-02-14")).toBe(true);
  });
  it("is sorted and has the requested number of runs in a full week", () => {
    const dates = plan.sessions.map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
    expect(plan.sessions.filter((s) => s.week === 3)).toHaveLength(4);
    expect(plan.weeks).toBe(13);
  });
  it("puts the long run on Sunday and never before today", () => {
    const longs = plan.sessions.filter((s) => s.kind === "long");
    expect(longs.every((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay() === 0)).toBe(true);
    expect(plan.sessions[0]!.date >= TODAY).toBe(true);
    expect(Math.max(...longs.map((s) => s.distanceM))).toBeLessThanOrEqual(
      GOALS.half.longMax * 1000,
    );
  });
  it("alternates tempo and intervals", () => {
    const q = plan.sessions
      .filter((s) => s.kind === "tempo" || s.kind === "intervals")
      .slice(0, 4)
      .map((s) => s.kind);
    expect(q).toEqual(["tempo", "intervals", "tempo", "intervals"]);
  });
  it("leaves a rest day before the race", () => {
    const race = plan.sessions.at(-1)!;
    expect(plan.sessions.some((s) => s.date === addDays(race.date, -1))).toBe(false);
  });
  it("drops sessions earlier than today when starting mid-week", () => {
    const mid = ok(
      generatePlan({
        goal: "10k",
        raceDate: "2027-01-24",
        today: "2026-11-19",
        daysPerWeek: 5,
        currentWeeklyKm: 20,
      }),
    );
    expect(mid.sessions[0]!.date >= "2026-11-19").toBe(true);
    expect(dayDiff(mid.sessions[0]!.date, "2026-11-19")).toBeGreaterThanOrEqual(0);
  });
  it("supports every days-per-week option", () => {
    for (const d of [3, 4, 5, 6]) {
      const p = ok(
        generatePlan({
          goal: "10k",
          raceDate: "2027-02-07",
          today: TODAY,
          daysPerWeek: d,
          currentWeeklyKm: 30,
        }),
      );
      expect(p.sessions.filter((s) => s.week === 2)).toHaveLength(d);
    }
  });
  it("race day weeks put the race on the right day of a week that ends on it", () => {
    const p = ok(
      generatePlan({
        goal: "5k",
        raceDate: "2026-12-16",
        today: TODAY,
        daysPerWeek: 3,
        currentWeeklyKm: 15,
      }),
    );
    expect(p.sessions.at(-1)).toMatchObject({ date: "2026-12-16", kind: "race" });
  });
});
