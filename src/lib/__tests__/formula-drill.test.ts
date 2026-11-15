import { describe, it, expect, beforeEach } from 'vitest';
import { Rating, State, type Grade } from 'ts-fsrs';
import {
  EMPTY_DRILL,
  FORMULA_DRILL_KEY,
  SAME_SESSION_MS,
  drillCounts,
  drillQueue,
  endOfLocalDay,
  formatInterval,
  fromStored,
  gradeFormula,
  isNewCard,
  parseDrill,
  previewDue,
  readDrill,
  returnsThisSession,
  toStored,
  writeDrill,
  type DrillFile,
} from '../formula-drill';

const NOW = new Date(2026, 10, 14, 9, 0, 0);
const IDS = ['F-ALG-01', 'F-ALG-02', 'F-GEO-01', 'F-NT-01'];

describe('grading a formula', () => {
  it('creates a card on the first grade and leaves the input untouched', () => {
    const next = gradeFormula(EMPTY_DRILL, 'F-ALG-01', Rating.Good, NOW);
    expect(EMPTY_DRILL.cards).toEqual({});
    expect(isNewCard(next, 'F-ALG-01')).toBe(false);
    expect(next.cards['F-ALG-01']?.reps).toBe(1);
    expect(next.cards['F-ALG-01']?.last_review).toBe(NOW.toISOString());
  });

  it('pushes the card further out the better the grade', () => {
    const due = (grade: typeof Rating.Again | typeof Rating.Easy | typeof Rating.Good) =>
      Date.parse(gradeFormula(EMPTY_DRILL, 'F-ALG-01', grade, NOW).cards['F-ALG-01']?.due ?? '');
    expect(due(Rating.Again)).toBeLessThan(due(Rating.Good));
    expect(due(Rating.Good)).toBeLessThan(due(Rating.Easy));
  });

  it('is deterministic: the same history gives the same schedule', () => {
    const run = () =>
      ([Rating.Good, Rating.Good, Rating.Hard] as Grade[]).reduce<{ file: DrillFile; at: Date }>(
        ({ file, at }, grade) => {
          const next = gradeFormula(file, 'F-NT-01', grade, at);
          return { file: next, at: new Date(Date.parse(next.cards['F-NT-01']?.due ?? '')) };
        },
        { file: EMPTY_DRILL, at: NOW },
      ).file;
    expect(run()).toEqual(run());
  });

  it('previews the due date of every grade, matching what grading then does', () => {
    const preview = previewDue(EMPTY_DRILL, 'F-GEO-01', NOW);
    for (const grade of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
      const graded = gradeFormula(EMPTY_DRILL, 'F-GEO-01', grade, NOW);
      expect(preview[grade].toISOString()).toBe(graded.cards['F-GEO-01']?.due);
    }
  });

  it('brings an Again card back in the same sitting and an Easy one on a later day', () => {
    const again = gradeFormula(EMPTY_DRILL, 'F-ALG-01', Rating.Again, NOW);
    expect(returnsThisSession(again, 'F-ALG-01', NOW)).toBe(true);
    const easy = gradeFormula(EMPTY_DRILL, 'F-ALG-01', Rating.Easy, NOW);
    expect(returnsThisSession(easy, 'F-ALG-01', NOW)).toBe(false);
    expect(Date.parse(easy.cards['F-ALG-01']?.due ?? '') - NOW.getTime()).toBeGreaterThan(
      SAME_SESSION_MS,
    );
  });
});

describe('counting and queueing', () => {
  it('counts never-drilled cards as fresh, and splits drilled ones into due today and later', () => {
    let file = gradeFormula(EMPTY_DRILL, 'F-ALG-01', Rating.Again, NOW); // due in minutes
    file = gradeFormula(file, 'F-ALG-02', Rating.Easy, NOW); // due in days
    expect(drillCounts(file, IDS, NOW)).toEqual({ due: 1, fresh: 2, later: 1 });
  });

  it('queues due cards first, most overdue first, then fresh ones in sheet order up to the limit', () => {
    const early = new Date(NOW.getTime() - 3 * 86_400_000);
    let file = gradeFormula(EMPTY_DRILL, 'F-GEO-01', Rating.Good, early);
    file = gradeFormula(file, 'F-ALG-02', Rating.Again, NOW);
    const queue = drillQueue(file, IDS, NOW, 1);
    expect(queue).toEqual(['F-GEO-01', 'F-ALG-02', 'F-ALG-01']);
    expect(drillQueue(file, IDS, NOW)).toEqual(['F-GEO-01', 'F-ALG-02', 'F-ALG-01', 'F-NT-01']);
  });

  it('only considers the ids it is given, so "must-know only" narrows the deck', () => {
    const file = gradeFormula(EMPTY_DRILL, 'F-NT-01', Rating.Again, NOW);
    expect(drillQueue(file, ['F-ALG-01'], NOW)).toEqual(['F-ALG-01']);
    expect(drillCounts(file, ['F-ALG-01'], NOW)).toEqual({ due: 0, fresh: 1, later: 0 });
  });

  it('treats "today" as the local calendar day', () => {
    const end = endOfLocalDay(NOW);
    expect(end.getDate()).toBe(NOW.getDate());
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips a card through JSON without losing a field', () => {
    const file = gradeFormula(EMPTY_DRILL, 'F-ALG-01', Rating.Hard, NOW);
    const stored = file.cards['F-ALG-01'];
    expect(stored).toBeDefined();
    if (!stored) return;
    const card = fromStored(stored);
    expect(card.due).toBeInstanceOf(Date);
    expect(card.state).not.toBe(State.New);
    expect(toStored(card)).toEqual(stored);
  });

  it('reads back what it wrote, under ka-amc-formulas', () => {
    const file = gradeFormula(EMPTY_DRILL, 'F-ALG-01', Rating.Good, NOW);
    expect(writeDrill(file)).toBe(true);
    expect(window.localStorage.getItem(FORMULA_DRILL_KEY)).not.toBeNull();
    expect(readDrill()).toEqual(file);
  });

  it('turns junk into an empty deck and drops a malformed card on its own', () => {
    expect(parseDrill(null).cards).toEqual({});
    expect(parseDrill('not json').cards).toEqual({});
    expect(parseDrill('[1,2]').cards).toEqual({});
    const good = gradeFormula(EMPTY_DRILL, 'F-ALG-01', Rating.Good, NOW).cards['F-ALG-01'];
    const parsed = parseDrill(
      JSON.stringify({ version: 1, cards: { 'F-ALG-01': good, 'F-ALG-02': { due: 'never' } } }),
    );
    expect(Object.keys(parsed.cards)).toEqual(['F-ALG-01']);
  });

  it('survives storage that throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(readDrill().cards).toEqual({});
      expect(writeDrill(EMPTY_DRILL)).toBe(false);
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});

describe('formatInterval', () => {
  it.each([
    [10_000, 'under a minute'],
    [10 * 60_000, '10 min'],
    [60 * 60_000, '1 hour'],
    [5 * 3_600_000, '5 hours'],
    [86_400_000, '1 day'],
    [3 * 86_400_000, '3 days'],
    [60 * 86_400_000, '2 months'],
    [400 * 86_400_000, '1 year'],
  ])('%i ms reads as %s', (ms, words) => {
    expect(formatInterval(NOW, new Date(NOW.getTime() + ms))).toBe(words);
  });
});
