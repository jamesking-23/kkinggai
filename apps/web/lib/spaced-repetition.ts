/** Spaced repetition scheduling (SM-2 style). Pure: callers pass `now` so results are testable. */

export const RATINGS = { again: 0, hard: 1, good: 2, easy: 3 } as const;
export type Rating = (typeof RATINGS)[keyof typeof RATINGS];

export type CardState = { ease: number; intervalDays: number; repetitions: number; lapses: number };
export type Schedule = CardState & { dueAt: Date };

const MIN_EASE = 1.3;
const MAX_EASE = 4.0;
const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN_DELAY_MS = 10 * 60 * 1000;

const clampEase = (e: number) => Math.round(Math.min(MAX_EASE, Math.max(MIN_EASE, e)) * 100) / 100;

export function isRating(n: number): n is Rating {
  return n === 0 || n === 1 || n === 2 || n === 3;
}

/** Returns the new scheduling state after the card is answered with `rating` at `now`. */
export function schedule(card: CardState, rating: Rating, now: Date): Schedule {
  if (rating === RATINGS.again) {
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
  if (rating === RATINGS.hard) {
    interval = Math.max(1, Math.round(Math.max(card.intervalDays, 1) * 1.2));
    ease -= 0.15;
  } else if (rating === RATINGS.good) {
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
