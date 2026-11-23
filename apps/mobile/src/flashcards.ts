// Flashcard helpers, mirroring apps/web/lib/spaced-repetition.ts and the card/deck rules in packages/schemas. Pure.
// The scheduling maths is repeated from the website so a review gives the same result on both; keep them in sync.

export const RATINGS = [
  { value: 0, label: "Again" },
  { value: 1, label: "Hard" },
  { value: 2, label: "Good" },
  { value: 3, label: "Easy" },
] as const;
export type Rating = 0 | 1 | 2 | 3;

export type CardState = { ease: number; intervalDays: number; repetitions: number; lapses: number };
export type Schedule = CardState & { dueAt: Date };

const MIN_EASE = 1.3;
const MAX_EASE = 4.0;
const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN_DELAY_MS = 10 * 60 * 1000;
const clampEase = (e: number) => Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, e)) * 100) / 100;

export function schedule(card: CardState, rating: Rating, now: Date): Schedule {
  if (rating === 0) {
    return {
      ease: clampEase(card.ease - 0.2),
      intervalDays: 0,
      repetitions: 0,
      lapses: card.lapses + 1,
      dueAt: new Date(now.getTime() + AGAIN_DELAY_MS),
    };
  }
  let interval: number;
  let ease = card.ease;
  if (rating === 1) {
    interval = Math.max(1, Math.round(Math.max(card.intervalDays, 1) * 1.2));
    ease -= 0.15;
  } else if (rating === 2) {
    interval =
      card.repetitions === 0
        ? 1
        : card.repetitions === 1
          ? 6
          : Math.round(card.intervalDays * card.ease);
  } else {
    interval =
      card.repetitions === 0
        ? 4
        : Math.max(card.intervalDays + 1, Math.round(card.intervalDays * card.ease * 1.3));
    ease += 0.15;
  }
  interval = Math.max(1, interval);
  return {
    ease: clampEase(ease),
    intervalDays: interval,
    repetitions: card.repetitions + 1,
    lapses: card.lapses,
    dueAt: new Date(now.getTime() + interval * DAY_MS),
  };
}

export type DeckRow = { id: string; name: string; revision: number };
export type CardRow = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  due_at: string;
  ease: number | string;
  interval_days: number;
  repetitions: number;
  lapses: number;
  revision: number;
};

export const isDue = (c: Pick<CardRow, "due_at">, now: Date) => new Date(c.due_at) <= now;

/** Due cards, oldest due first, optionally for one deck. */
export function dueCards(cards: readonly CardRow[], now: Date, deckId?: string | null): CardRow[] {
  return cards
    .filter((c) => isDue(c, now) && (!deckId || c.deck_id === deckId))
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
}

/** Per deck: total cards and how many are due. Decks keep their given order. */
export function deckCounts(decks: readonly DeckRow[], cards: readonly CardRow[], now: Date) {
  return decks.map((d) => {
    const mine = cards.filter((c) => c.deck_id === d.id);
    return { deck: d, total: mine.length, due: mine.filter((c) => isDue(c, now)).length };
  });
}

export const cleanDeckName = (v: string) => v.trim().slice(0, 200);

/** Trimmed question and answer, or an error message. Limits match the website (2000 and 4000 characters). */
export function checkCard(front: string, back: string): { front: string; back: string } | string {
  const f = front.trim();
  const b = back.trim();
  if (!f) return "Enter the question.";
  if (!b) return "Enter the answer.";
  if (f.length > 2000) return "The question is too long (2000 characters at most).";
  if (b.length > 4000) return "The answer is too long (4000 characters at most).";
  return { front: f, back: b };
}
