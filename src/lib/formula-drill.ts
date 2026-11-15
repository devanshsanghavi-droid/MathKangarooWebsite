import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type State,
  type Card,
  type Grade,
} from 'ts-fsrs';

/**
 * The AMC formula flashcards' scheduler (docs/06 §5, `/amc/formulas/drill`).
 *
 * One FSRS card per formula, stored in the browser under `ka-amc-formulas`. Nothing is sent
 * anywhere: the drill works signed out, like every other practice surface.
 *
 * Unlike src/lib/schedule.ts, which schedules skills from the site's own judgement of an
 * attempt, here the student grades themselves (Again / Hard / Good / Easy). That is a recall
 * rating, not the site marking an answer, which is why the drill's grade buttons are neutral
 * and never the reserved feedback colours.
 *
 * Fuzz is off so the scheduler is deterministic and its tests are exact; a deck of ~80 cards
 * gains nothing from spreading reviews.
 *
 * Pure apart from `readDrill` / `writeDrill`, which wrap localStorage in try/catch: storage
 * can be missing or throw (private windows, blocked site data), and the drill still runs for
 * the visit without it.
 */

export const FORMULA_DRILL_KEY = 'ka-amc-formulas';
const VERSION = 1;

/** A graded card that comes back sooner than this is still being learned: re-show it now. */
export const SAME_SESSION_MS = 30 * 60 * 1000;

const scheduler = fsrs(generatorParameters({ enable_fuzz: false }));

export const DRILL_GRADES: ReadonlyArray<{ grade: Grade; label: string; key: string }> = [
  { grade: Rating.Again, label: 'Again', key: '1' },
  { grade: Rating.Hard, label: 'Hard', key: '2' },
  { grade: Rating.Good, label: 'Good', key: '3' },
  { grade: Rating.Easy, label: 'Easy', key: '4' },
];

/** A card as JSON: dates as ISO strings. */
export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

export interface DrillFile {
  version: number;
  /** Keyed by formula id. A formula with no entry has never been drilled. */
  cards: Record<string, StoredCard>;
}

export const EMPTY_DRILL: DrillFile = { version: VERSION, cards: {} };

/* -------------------------------------------------------------------------- */
/* (De)serialisation                                                           */
/* -------------------------------------------------------------------------- */

export function toStored(card: Card): StoredCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function fromStored(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state as State,
    ...(stored.last_review ? { last_review: new Date(stored.last_review) } : {}),
  };
}

const NUMBER_FIELDS = [
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
  'state',
] as const;

function isStoredCard(value: unknown): value is StoredCard {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Record<string, unknown>;
  if (typeof card.due !== 'string' || Number.isNaN(Date.parse(card.due))) return false;
  if (card.last_review !== null && typeof card.last_review !== 'string') return false;
  if (typeof card.last_review === 'string' && Number.isNaN(Date.parse(card.last_review)))
    return false;
  return NUMBER_FIELDS.every(
    (field) => typeof card[field] === 'number' && Number.isFinite(card[field]),
  );
}

/** Total: anything unreadable becomes an empty deck, and a bad card is dropped on its own. */
export function parseDrill(raw: string | null): DrillFile {
  if (!raw) return { version: VERSION, cards: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { version: VERSION, cards: {} };
    const cards = (parsed as { cards?: unknown }).cards;
    if (typeof cards !== 'object' || cards === null) return { version: VERSION, cards: {} };
    const out: Record<string, StoredCard> = {};
    for (const [id, card] of Object.entries(cards)) {
      if (isStoredCard(card)) out[id] = card;
    }
    return { version: VERSION, cards: out };
  } catch {
    return { version: VERSION, cards: {} };
  }
}

export function readDrill(): DrillFile {
  try {
    return parseDrill(window.localStorage.getItem(FORMULA_DRILL_KEY));
  } catch {
    return { version: VERSION, cards: {} };
  }
}

/** Returns false when storage refused the write, so the page can say progress is not kept. */
export function writeDrill(file: DrillFile): boolean {
  try {
    window.localStorage.setItem(FORMULA_DRILL_KEY, JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                  */
/* -------------------------------------------------------------------------- */

export function isNewCard(file: DrillFile, id: string): boolean {
  return !(id in file.cards);
}

/** The stored card, or a fresh one due now. */
export function cardFor(file: DrillFile, id: string, now: Date): Card {
  const stored = file.cards[id];
  return stored ? fromStored(stored) : createEmptyCard(now);
}

/** Grade one card. Pure: the file passed in is not changed. */
export function gradeFormula(file: DrillFile, id: string, grade: Grade, now: Date): DrillFile {
  const next = scheduler.next(cardFor(file, id, now), now, grade).card;
  return { version: VERSION, cards: { ...file.cards, [id]: toStored(next) } };
}

/** When the card would next be due under each grade, for the labels on the grade buttons. */
export function previewDue(file: DrillFile, id: string, now: Date): Record<Grade, Date> {
  const preview = scheduler.repeat(cardFor(file, id, now), now);
  return {
    [Rating.Again]: preview[Rating.Again].card.due,
    [Rating.Hard]: preview[Rating.Hard].card.due,
    [Rating.Good]: preview[Rating.Good].card.due,
    [Rating.Easy]: preview[Rating.Easy].card.due,
  } as Record<Grade, Date>;
}

/** "under a minute", "10 min", "1 day", "3 days", "2 months". Plain words, no symbols. */
export function formatInterval(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.round(hours / 24);
  if (days < 31) return days === 1 ? '1 day' : `${days} days`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;
  const years = Math.round(days / 365);
  return years === 1 ? '1 year' : `${years} years`;
}

/** The last millisecond of the local day `now` falls in. */
export function endOfLocalDay(now: Date): Date {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}

export interface DrillCounts {
  /** Drilled before and due by the end of today. */
  due: number;
  /** Never drilled. */
  fresh: number;
  /** Drilled and not due until a later day. */
  later: number;
}

export function drillCounts(file: DrillFile, ids: readonly string[], now: Date): DrillCounts {
  const end = endOfLocalDay(now).getTime();
  let due = 0;
  let fresh = 0;
  let later = 0;
  for (const id of ids) {
    const stored = file.cards[id];
    if (!stored) fresh += 1;
    else if (Date.parse(stored.due) <= end) due += 1;
    else later += 1;
  }
  return { due, fresh, later };
}

/**
 * Today's queue over `ids` (already in the order the sheet shows them: area, must-know
 * first): cards due by the end of today, most overdue first, then cards never drilled, in
 * sheet order, capped at `newLimit` so a first visit is a sitting and not all eighty at once.
 */
export function drillQueue(
  file: DrillFile,
  ids: readonly string[],
  now: Date,
  newLimit = Number.POSITIVE_INFINITY,
): string[] {
  const end = endOfLocalDay(now).getTime();
  const due = ids
    .filter((id) => {
      const stored = file.cards[id];
      return stored !== undefined && Date.parse(stored.due) <= end;
    })
    .sort((a, b) => Date.parse(file.cards[a]?.due ?? '') - Date.parse(file.cards[b]?.due ?? ''));
  const fresh = ids.filter((id) => !(id in file.cards)).slice(0, newLimit);
  return [...due, ...fresh];
}

/** After a grade: does the card come back in this sitting (it is due again within minutes)? */
export function returnsThisSession(file: DrillFile, id: string, now: Date): boolean {
  const stored = file.cards[id];
  if (!stored) return true;
  return Date.parse(stored.due) - now.getTime() < SAME_SESSION_MS;
}
