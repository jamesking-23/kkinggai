import { describe, expect, it } from "vitest";
import {
  checkCard,
  cleanDeckName,
  deckCounts,
  dueCards,
  schedule,
  type CardRow,
  type DeckRow,
} from "./flashcards";

const now = new Date("2026-11-23T12:00:00Z");
const card = (id: string, deck: string, due: string): CardRow => ({
  id,
  deck_id: deck,
  front: "q",
  back: "a",
  due_at: due,
  ease: 2.5,
  interval_days: 0,
  repetitions: 0,
  lapses: 0,
  revision: 1,
});
const base = { ease: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 };

describe("flashcards", () => {
  it("schedules like the website", () => {
    const again = schedule(base, 0, now);
    expect(again.dueAt.getTime() - now.getTime()).toBe(10 * 60 * 1000);
    expect(again.ease).toBe(2.3);
    expect(again.lapses).toBe(1);
    expect(again.repetitions).toBe(0);
    expect(schedule(base, 2, now).intervalDays).toBe(15);
    expect(schedule({ ...base, repetitions: 0 }, 2, now).intervalDays).toBe(1);
    expect(schedule({ ...base, repetitions: 1 }, 2, now).intervalDays).toBe(6);
    const hard = schedule(base, 1, now);
    expect(hard.intervalDays).toBe(7);
    expect(hard.ease).toBe(2.35);
    const easy = schedule(base, 3, now);
    expect(easy.intervalDays).toBe(20);
    expect(easy.ease).toBe(2.65);
    expect(schedule({ ...base, ease: 3.95 }, 3, now).ease).toBe(4);
    expect(schedule({ ...base, ease: 1.35 }, 0, now).ease).toBe(1.3);
  });

  it("lists due cards oldest first, optionally by deck", () => {
    const cards = [
      card("a", "d1", "2026-11-22T00:00:00Z"),
      card("b", "d2", "2026-11-20T00:00:00Z"),
      card("c", "d1", "2026-12-01T00:00:00Z"),
    ];
    expect(dueCards(cards, now).map((c) => c.id)).toEqual(["b", "a"]);
    expect(dueCards(cards, now, "d1").map((c) => c.id)).toEqual(["a"]);
  });

  it("counts cards per deck", () => {
    const decks: DeckRow[] = [
      { id: "d1", name: "One", revision: 1 },
      { id: "d2", name: "Two", revision: 1 },
    ];
    const cards = [
      card("a", "d1", "2026-11-22T00:00:00Z"),
      card("c", "d1", "2026-12-01T00:00:00Z"),
    ];
    expect(deckCounts(decks, cards, now).map((d) => [d.total, d.due])).toEqual([
      [2, 1],
      [0, 0],
    ]);
  });

  it("validates cards and deck names", () => {
    expect(checkCard(" Q ", " A ")).toEqual({ front: "Q", back: "A" });
    expect(checkCard("", "A")).toBe("Enter the question.");
    expect(checkCard("Q", " ")).toBe("Enter the answer.");
    expect(checkCard("x".repeat(2001), "A")).toMatch(/too long/);
    expect(cleanDeckName("  Bio  ")).toBe("Bio");
  });
});
