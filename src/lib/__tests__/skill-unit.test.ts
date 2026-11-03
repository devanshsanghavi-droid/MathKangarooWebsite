import { describe, it, expect } from 'vitest';
import {
  buildLessonRows,
  quizUnlocked,
  rungSatisfied,
  TIER_IMPLIED_POINTS,
  typicalDifficulty,
} from '../skill-unit.ts';
import { pickQuizProblems, QUIZ_SIZE } from '../skill-quiz.ts';
import { ladderState } from '../ladder.ts';
import { getProblemsForSkill } from '../content.ts';
import type { AttemptRecord } from '../mastery.ts';
import type { Points } from '../schemas.ts';

const solved = (problemId: string, points: Points, day: number): AttemptRecord => ({
  problemId,
  points,
  correct: true,
  hintsUsed: 0,
  at: `2026-03-0${day}T10:00:00.000Z`,
});

const EMPTY_ATTEMPTS: Record<Points, AttemptRecord[]> = { 3: [], 4: [], 5: [] };

describe('the lesson list', () => {
  const problemIdsByTier: Record<Points, string[]> = {
    3: ['KA-0001', 'KA-0002', 'KA-0003'],
    4: ['KA-0004'],
    5: [],
  };

  it('is Learn, three ladders, then the quiz - in that order', () => {
    const rows = buildLessonRows({
      skillId: 'CNT-12',
      problemIdsByTier,
      attemptsByTier: EMPTY_ATTEMPTS,
      hasWorkedExample: true,
    });
    expect(rows.map((row) => row.kind)).toEqual(['learn', 'ladder', 'ladder', 'ladder', 'quiz']);
    expect(rows.map((row) => row.href)).toEqual([
      '/skill/CNT-12/learn',
      '/skill/CNT-12/practice/3',
      '/skill/CNT-12/practice/4',
      '/skill/CNT-12/practice/5',
      '/skill/CNT-12/quiz',
    ]);
  });

  it('gives every ladder a greyscale-legible glyph rather than a colour', () => {
    const rows = buildLessonRows({
      skillId: 'CNT-12',
      problemIdsByTier,
      attemptsByTier: EMPTY_ATTEMPTS,
      hasWorkedExample: true,
    });
    expect(rows.filter((r) => r.kind === 'ladder').map((r) => r.icon)).toEqual([
      '●○○',
      '●●○',
      '●●●',
    ]);
  });

  it('locks a tier with nothing written on it, and says why', () => {
    const rows = buildLessonRows({
      skillId: 'CNT-12',
      problemIdsByTier,
      attemptsByTier: EMPTY_ATTEMPTS,
      hasWorkedExample: true,
    });
    const fivePoint = rows.find((row) => row.points === 5);
    expect(fivePoint?.locked).toBe(true);
    expect(fivePoint?.lockReason).toMatch(/Nothing written at this tier yet/);
  });

  it('mentions the worked example only when there is one', () => {
    const withExample = buildLessonRows({
      skillId: 'CNT-12',
      problemIdsByTier,
      attemptsByTier: EMPTY_ATTEMPTS,
      hasWorkedExample: true,
    })[0];
    const without = buildLessonRows({
      skillId: 'CNT-12',
      problemIdsByTier,
      attemptsByTier: EMPTY_ATTEMPTS,
      hasWorkedExample: false,
    })[0];
    expect(withExample?.blurb).toMatch(/worked example/);
    expect(without?.blurb).not.toMatch(/worked example/);
  });
});

describe('the quiz lock', () => {
  it('is shut while any stocked ladder is unfinished', () => {
    expect(
      quizUnlocked([
        ladderState(['KA-0001'], []),
        ladderState(['KA-0002'], []),
        ladderState([], []),
      ]),
    ).toBe(false);
  });

  it('opens once every stocked ladder is finished - an empty tier cannot be a barrier', () => {
    const done = ladderState(
      ['KA-0001', 'KA-0002', 'KA-0003'],
      [solved('KA-0001', 3, 1), solved('KA-0002', 3, 1), solved('KA-0003', 3, 2)],
    );
    expect(quizUnlocked([done, ladderState([], []), ladderState([], [])])).toBe(true);
  });

  it('stays shut for a skill with no problems anywhere', () => {
    expect(quizUnlocked([ladderState([], []), ladderState([], []), ladderState([], [])])).toBe(
      false,
    );
  });

  it('treats an empty rung as satisfied', () => {
    expect(rungSatisfied(ladderState([], []))).toBe(true);
    expect(rungSatisfied(ladderState(['KA-0001'], []))).toBe(false);
  });
});

describe('the difficulty pill on a skill', () => {
  it('is whichever tier the skill has most problems at', () => {
    expect(typicalDifficulty({ 3: 1, 4: 6, 5: 2 }, 'core')).toBe(4);
  });

  it('breaks a tie downward, toward the easier tier', () => {
    expect(typicalDifficulty({ 3: 3, 4: 3, 5: 0 }, 'core')).toBe(3);
  });

  it('falls back to what the Atlas tier implies when nothing is written', () => {
    expect(typicalDifficulty({ 3: 0, 4: 0, 5: 0 }, 'gateway')).toBe(TIER_IMPLIED_POINTS.gateway);
    expect(typicalDifficulty({ 3: 0, 4: 0, 5: 0 }, 'foundation')).toBe(3);
  });
});

describe('picking the quiz', () => {
  it('is five problems, or everything there is', () => {
    const problems = getProblemsForSkill('CNT-12');
    const picked = pickQuizProblems(problems);
    expect(picked.length).toBe(Math.min(QUIZ_SIZE, problems.length));
  });

  it('is deterministic, so a tutor and a student see the same five', () => {
    const problems = getProblemsForSkill('CNT-12');
    expect(pickQuizProblems(problems).map((p) => p.id)).toEqual(
      pickQuizProblems([...problems].reverse()).map((p) => p.id),
    );
  });

  it('comes out in ascending difficulty', () => {
    const points = pickQuizProblems(getProblemsForSkill('NUM-01')).map((p) => p.points);
    expect([...points].sort((a, b) => a - b)).toEqual(points);
  });

  it('backfills rather than returning a two-question quiz', () => {
    // A skill with only 3-pointers must still get five, drawn from the same tier.
    const threes = getProblemsForSkill('CNT-12').filter((p) => p.points === 3);
    if (threes.length >= QUIZ_SIZE) {
      expect(pickQuizProblems(threes)).toHaveLength(QUIZ_SIZE);
    }
  });

  it('never repeats a problem', () => {
    const ids = pickQuizProblems(getProblemsForSkill('GEO-10')).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
