import { describe, expect, it } from "vitest";
import { isRating, schedule, type CardState } from "./spaced-repetition";

const now = new Date("2026-11-09T10:00:00Z");
const fresh: CardState = { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };
const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / 86_400_000);

describe("schedule", () => {
  it("good: 1 day, then 6 days, then grows by ease", () => {
    const a = schedule(fresh, 2, now);
    expect(a).toMatchObject({ intervalDays: 1, repetitions: 1, ease: 2.5 });
    expect(days(a.dueAt)).toBe(1);
    const b = schedule(a, 2, now);
    expect(b.intervalDays).toBe(6);
    const c = schedule(b, 2, now);
    expect(c.intervalDays).toBe(15); // 6 * 2.5
    expect(c.repetitions).toBe(3);
  });

  it("again resets progress, counts a lapse, lowers ease and is due in minutes", () => {
    const s = schedule({ ease: 2.5, intervalDays: 15, repetitions: 3, lapses: 1 }, 0, now);
    expect(s).toMatchObject({ intervalDays: 0, repetitions: 0, lapses: 2, ease: 2.3 });
    expect(s.dueAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("hard grows slowly and lowers ease; easy grows fast and raises ease", () => {
    const base: CardState = { ease: 2.5, intervalDays: 10, repetitions: 3, lapses: 0 };
    expect(schedule(base, 1, now)).toMatchObject({ intervalDays: 12, ease: 2.35 });
    expect(schedule(base, 3, now)).toMatchObject({ intervalDays: 33, ease: 2.65 });
    expect(schedule(fresh, 3, now).intervalDays).toBe(4);
  });

  it("keeps ease within bounds and intervals at least a day for passing answers", () => {
    let c: CardState = { ease: 1.35, intervalDays: 1, repetitions: 2, lapses: 0 };
    for (let i = 0; i < 5; i++) c = schedule(c, 0, now);
    expect(c.ease).toBe(1.3);
    let e: CardState = { ease: 3.95, intervalDays: 100, repetitions: 5, lapses: 0 };
    for (let i = 0; i < 5; i++) e = schedule(e, 3, now);
    expect(e.ease).toBe(4);
    expect(schedule(fresh, 1, now).intervalDays).toBeGreaterThanOrEqual(1);
  });

  it("validates ratings", () => {
    expect([0, 1, 2, 3].every(isRating)).toBe(true);
    expect(isRating(4)).toBe(false);
    expect(isRating(-1)).toBe(false);
  });
});
