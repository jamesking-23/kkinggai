import { describe, expect, it } from "vitest";
import { buildQuiz, gradeQuiz, type QuizCard } from "./quiz";

const cards: QuizCard[] = ["a", "b", "c", "d", "e", "f"].map((x) => ({
  id: x,
  front: `Q-${x}`,
  back: `A-${x}`,
}));

/** Small deterministic generator so tests are repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("buildQuiz", () => {
  it("builds questions whose options include the right answer exactly once and no duplicate texts", () => {
    const quiz = buildQuiz(cards, 6, seeded(1));
    expect(quiz).toHaveLength(6);
    for (const q of quiz) {
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.id === q.cardId)).toHaveLength(1);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
      const own = cards.find((c) => c.id === q.cardId)!;
      expect(q.options.find((o) => o.id === q.cardId)!.text).toBe(own.back);
    }
  });

  it("respects the requested count and returns nothing without enough distinct answers", () => {
    expect(buildQuiz(cards, 3, seeded(2))).toHaveLength(3);
    expect(buildQuiz(cards.slice(0, 3), 3)).toEqual([]);
    const sameAnswers = cards.map((c) => ({ ...c, back: "same" }));
    expect(buildQuiz(sameAnswers, 5)).toEqual([]);
    const dup = [...cards.slice(0, 4), { id: "z", front: "Q-z", back: " a-a " }];
    expect(buildQuiz(dup, 10, seeded(3))).toHaveLength(4); // the duplicate answer text is dropped
  });

  it("is repeatable for a given seed", () => {
    expect(buildQuiz(cards, 4, seeded(7))).toEqual(buildQuiz(cards, 4, seeded(7)));
  });
});

describe("gradeQuiz", () => {
  it("scores answers and counts unanswered or wrong ones as missed", () => {
    const r = gradeQuiz(["a", "b", "c", "d"], { a: "a", b: "x", c: "c" });
    expect(r).toEqual({ correct: 2, total: 4, percent: 50, missed: ["b", "d"] });
    expect(gradeQuiz([], {})).toEqual({ correct: 0, total: 0, percent: 0, missed: [] });
  });
});
