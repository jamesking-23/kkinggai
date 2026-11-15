import { describe, expect, it } from "vitest";
import { buildCoachContext, type CoachRun } from "./coach";

const NOW = new Date("2026-11-15T10:00:00Z"); // Sunday
const run = (over: Partial<CoachRun> = {}): CoachRun => ({
  started_at: "2026-11-14T05:00:00Z",
  kind: "long",
  distance_m: 15000,
  moving_seconds: 5400,
  elevation_gain_m: 120,
  avg_hr: 148,
  effort: 6,
  ...over,
});

describe("buildCoachContext", () => {
  it("summarises weeks, recent runs and the plan", () => {
    const text = buildCoachContext({
      runs: [
        run(),
        run({
          started_at: "2026-11-10T05:00:00Z",
          kind: "easy",
          distance_m: 6000,
          moving_seconds: 2100,
          elevation_gain_m: null,
          avg_hr: null,
          effort: null,
        }),
      ],
      plan: { goal: "half", race_date: "2027-02-14", weeks: 13, days_per_week: 4 },
      sessions: [
        { planned_on: "2026-11-17", kind: "tempo", distance_m: 6000, status: "planned" },
        { planned_on: "2026-12-30", kind: "easy", distance_m: 5000, status: "planned" },
      ],
      now: NOW,
      timeZone: "Africa/Kampala",
    });
    expect(text).toContain("Today: 2026-11-15");
    expect(text).toContain("2026-11-09: 21.0 km, 2 runs");
    expect(text).toContain("2026-11-14 | Long run | 15.0 | 1:30:00 | 6:00/km | 120 m | 148 | 6");
    expect(text).toContain("2026-11-10 | Easy | 6.0 | 35:00 | 5:50/km | - | - | -");
    expect(text).toContain("Half marathon on 2027-02-14 (91 days away)");
    expect(text).toContain("2026-11-17 | Tempo | 6.0 | planned");
    expect(text).not.toContain("2026-12-30");
  });
  it("handles no runs and no plan", () => {
    const text = buildCoachContext({
      runs: [],
      plan: null,
      sessions: [],
      now: NOW,
      timeZone: "UTC",
    });
    expect(text).toContain("No runs logged");
    expect(text).toContain("No active training plan.");
  });
  it("never includes names, notes or GPS routes even if the rows carry them", () => {
    const leaky = {
      ...run(),
      name: "Secret Park Loop",
      notes: "knee hurt near my house",
      route: [[0.31234, 32.58123]],
      id: "abc",
    };
    const text = buildCoachContext({
      runs: [leaky as CoachRun],
      plan: null,
      sessions: [],
      now: NOW,
      timeZone: "UTC",
    });
    expect(text).not.toContain("Secret Park");
    expect(text).not.toContain("knee");
    expect(text).not.toContain("0.31234");
    expect(text).not.toContain("abc");
  });
  it("limits the number of recent runs listed", () => {
    const runs = Array.from({ length: 30 }, (_, i) =>
      run({ started_at: `2026-10-${String((i % 28) + 1).padStart(2, "0")}T05:00:00Z` }),
    );
    const text = buildCoachContext({
      runs,
      plan: null,
      sessions: [],
      now: NOW,
      timeZone: "UTC",
      maxRuns: 5,
    });
    expect(text.split("\n").filter((l) => l.includes("| Long run |"))).toHaveLength(5);
  });
});
