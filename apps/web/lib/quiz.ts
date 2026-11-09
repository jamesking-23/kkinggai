/** Multiple-choice quizzes built from flashcards. Pure: pass an `rng` for repeatable tests. */

export type QuizCard = { id: string; front: string; back: string };
export type QuizOption = { id: string; text: string };
export type QuizQuestion = { cardId: string; prompt: string; options: QuizOption[] };

export const MIN_QUIZ_CARDS = 4;
export const OPTIONS_PER_QUESTION = 4;

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Builds up to `count` questions. Each option is another card's answer; the option id is that card's id, so grading is
 * just "did the selected id equal the question's card id". Distractors never repeat the correct answer's text.
 * Returns [] when there are fewer than MIN_QUIZ_CARDS cards with distinct answers.
 */
export function buildQuiz(
  cards: QuizCard[],
  count: number,
  rng: () => number = Math.random,
): QuizQuestion[] {
  const distinct: QuizCard[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    if (!seen.has(norm(c.back))) {
      seen.add(norm(c.back));
      distinct.push(c);
    }
  }
  if (distinct.length < MIN_QUIZ_CARDS) return [];

  return shuffle(distinct, rng)
    .slice(0, Math.max(1, count))
    .map((card) => {
      const distractors = shuffle(
        distinct.filter((c) => c.id !== card.id),
        rng,
      ).slice(0, OPTIONS_PER_QUESTION - 1);
      const options = shuffle([card, ...distractors], rng).map((c) => ({ id: c.id, text: c.back }));
      return { cardId: card.id, prompt: card.front, options };
    });
}

export type QuizResult = { correct: number; total: number; percent: number; missed: string[] };

/** `answers` maps question card id -> selected option id. Unanswered questions count as missed. */
export function gradeQuiz(
  questionIds: string[],
  answers: Record<string, string | undefined>,
): QuizResult {
  const missed = questionIds.filter((id) => answers[id] !== id);
  const total = questionIds.length;
  const correct = total - missed.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, missed };
}
