/** Spaced repetition (SM-2 variant) for flashcards. Days are counted as integer epoch days. */

export interface CardState {
  ease: number;
  /** Interval in days. */
  interval: number;
  reps: number;
  lapses: number;
  /** Epoch day when the card is due. */
  due: number;
  last: number;
}

export type Rating = 0 | 1 | 2 | 3; // again, hard, good, easy

export const RATING_LABELS: Record<Rating, string> = { 0: 'שוב', 1: 'קשה', 2: 'טוב', 3: 'קל' };

export function today(now = Date.now()): number {
  const d = new Date(now);
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

export function newCard(day = today()): CardState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: day, last: day };
}

export function review(card: CardState, rating: Rating, day = today()): CardState {
  const q = [1, 3, 4, 5][rating];
  let { ease, interval, reps, lapses } = card;
  if (rating === 0) {
    reps = 0;
    lapses += 1;
    interval = 0; // see it again in this session / today
  } else {
    reps += 1;
    if (reps === 1) interval = rating === 3 ? 3 : 1;
    else if (reps === 2) interval = rating === 1 ? 2 : rating === 3 ? 7 : 4;
    else interval = Math.max(interval + 1, Math.round(interval * ease * (rating === 1 ? 0.75 : rating === 3 ? 1.3 : 1)));
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ease: Math.round(ease * 100) / 100, interval, reps, lapses, due: day + interval, last: day };
}

/** 0..1 – how well the card is known (interval of three weeks or more counts as mastered). */
export function mastery(card: CardState | undefined): number {
  if (!card || card.reps === 0) return 0;
  return Math.min(1, card.interval / 21);
}

/** Preview of the next interval for each rating (for button labels). */
export function previewIntervals(card: CardState, day = today()): Record<Rating, number> {
  return {
    0: review(card, 0, day).interval,
    1: review(card, 1, day).interval,
    2: review(card, 2, day).interval,
    3: review(card, 3, day).interval,
  };
}
