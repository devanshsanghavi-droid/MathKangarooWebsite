import { describe, it, expect } from 'vitest';
import {
  dueSkills,
  isDue,
  newSkillCard,
  pickProblem,
  pointCeiling,
  Rating,
  ratingFor,
  reviewSkill,
  State,
  type SkillSchedule,
} from '../schedule';
import { getProblemsForSkill } from '../content';
import type { AttemptRecord } from '../mastery';
import type { Points } from '../schemas';

const NOW = new Date('2026-03-01T12:00:00Z');
const later = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

function a(day: number, correct: boolean, { points = 3 as Points, hints = 0 } = {}): AttemptRecord {
  return {
    problemId: `KA-${String(day).padStart(4, '0')}`,
    points,
    correct,
    hintsUsed: hints,
    at: `2026-03-${String(day).padStart(2, '0')}T10:00:00Z`,
  };
}

describe('ratingFor', () => {
  it('rates a wrong answer Again', () => {
    expect(ratingFor({ correct: false, hintsUsed: 0 })).toBe(Rating.Again);
    // Even a wrong answer with no hints is Again: it was wrong.
    expect(ratingFor({ correct: false, hintsUsed: 3 })).toBe(Rating.Again);
  });

  it('rates a correct answer that needed the strategy or the solution Hard', () => {
    expect(ratingFor({ correct: true, hintsUsed: 2 })).toBe(Rating.Hard);
    expect(ratingFor({ correct: true, hintsUsed: 3 })).toBe(Rating.Hard);
  });

  it('rates a correct answer that needed only the nudge Good', () => {
    expect(ratingFor({ correct: true, hintsUsed: 1 })).toBe(Rating.Good);
  });

  it('rates an unaided, in-time answer Easy', () => {
    expect(ratingFor({ correct: true, hintsUsed: 0, msElapsed: 40_000, estSeconds: 60 })).toBe(
      Rating.Easy,
    );
  });

  it('rates an unaided but slow answer Good rather than Easy', () => {
    expect(ratingFor({ correct: true, hintsUsed: 0, msElapsed: 120_000, estSeconds: 60 })).toBe(
      Rating.Good,
    );
  });

  it('rates an unaided answer Good when there is no timing to judge by', () => {
    expect(ratingFor({ correct: true, hintsUsed: 0 })).toBe(Rating.Good);
  });
});

describe('cards and due dates', () => {
  it('treats a brand-new card as due immediately', () => {
    expect(isDue(newSkillCard(NOW), NOW)).toBe(true);
    expect(newSkillCard(NOW).state).toBe(State.New);
  });

  it('pushes the due date out after a good review', () => {
    const card = reviewSkill(newSkillCard(NOW), Rating.Good, NOW);
    expect(card.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(isDue(card, NOW)).toBe(false);
  });

  it('brings a lapsed skill back sooner than a remembered one', () => {
    const learned = reviewSkill(
      reviewSkill(newSkillCard(NOW), Rating.Easy, NOW),
      Rating.Easy,
      later(1),
    );
    const failed = reviewSkill(learned, Rating.Again, later(2));
    const passed = reviewSkill(learned, Rating.Good, later(2));
    expect(failed.due.getTime()).toBeLessThan(passed.due.getTime());
  });

  it('counts a lapse when an answer is wrong', () => {
    const learned = reviewSkill(
      reviewSkill(newSkillCard(NOW), Rating.Easy, NOW),
      Rating.Easy,
      later(1),
    );
    expect(reviewSkill(learned, Rating.Again, later(2)).lapses).toBeGreaterThan(learned.lapses);
  });

  it('does not mutate the card it was given', () => {
    const card = newSkillCard(NOW);
    const before = JSON.stringify(card);
    reviewSkill(card, Rating.Good, NOW);
    expect(JSON.stringify(card)).toBe(before);
  });

  it('is deterministic — fuzz is off, so two identical reviews agree exactly', () => {
    const one = reviewSkill(newSkillCard(NOW), Rating.Good, NOW);
    const two = reviewSkill(newSkillCard(NOW), Rating.Good, NOW);
    expect(one.due.toISOString()).toBe(two.due.toISOString());
    expect(one.stability).toBe(two.stability);
  });
});

describe('dueSkills', () => {
  const schedules: SkillSchedule[] = [
    { skillId: 'CNT-12', card: { ...newSkillCard(NOW), due: later(-5), state: State.Review } },
    { skillId: 'GEO-10', card: { ...newSkillCard(NOW), due: later(-9), state: State.Review } },
    { skillId: 'NUM-01', card: { ...newSkillCard(NOW), due: later(3), state: State.Review } },
    { skillId: 'AAA-01', card: { ...newSkillCard(NOW), due: later(-5), state: State.Review } },
  ];

  it('returns only what is due', () => {
    expect(dueSkills(schedules, NOW).map((s) => s.skillId)).not.toContain('NUM-01');
  });

  it('puts the most overdue first, breaking ties on skill id', () => {
    expect(dueSkills(schedules, NOW).map((s) => s.skillId)).toEqual(['GEO-10', 'AAA-01', 'CNT-12']);
  });

  it('honours a limit, for a ten-minute session', () => {
    expect(dueSkills(schedules, NOW, 2).map((s) => s.skillId)).toEqual(['GEO-10', 'AAA-01']);
  });

  it('includes never-seen skills, which are due by definition', () => {
    const fresh: SkillSchedule[] = [{ skillId: 'PAT-01', card: newSkillCard(later(10)) }];
    expect(dueSkills(fresh, NOW).map((s) => s.skillId)).toEqual(['PAT-01']);
  });
});

describe('pointCeiling', () => {
  it('starts at 3 with no history', () => {
    expect(pointCeiling([])).toBe(3);
  });

  it('rises to 4 after an unaided 3-point solve', () => {
    expect(pointCeiling([a(1, true, { points: 3 })])).toBe(4);
  });

  it('rises to 5 only after clearing 4', () => {
    expect(pointCeiling([a(1, true, { points: 3 }), a(2, true, { points: 4 })])).toBe(5);
  });

  it('does not rise on a solve that leaned on hint 2 or 3', () => {
    expect(pointCeiling([a(1, true, { points: 3, hints: 2 })])).toBe(3);
  });

  it('falls back after a miss at the ceiling', () => {
    const history = [
      a(1, true, { points: 3 }),
      a(2, true, { points: 4 }),
      a(3, false, { points: 5 }),
    ];
    expect(pointCeiling(history)).toBe(4);
  });

  it('never goes below 3 or above 5', () => {
    expect(pointCeiling([a(1, false, { points: 3 }), a(2, false, { points: 3 })])).toBe(3);
    const climb = [
      a(1, true, { points: 3 }),
      a(2, true, { points: 4 }),
      a(3, true, { points: 5 }),
      a(4, true, { points: 5 }),
    ];
    expect(pointCeiling(climb)).toBe(5);
  });

  it('ignores attempts at a tier other than the current ceiling', () => {
    // A 5-point miss while still capped at 3 says nothing about the 3-point tier.
    expect(pointCeiling([a(1, false, { points: 5 })])).toBe(3);
  });
});

describe('pickProblem — the point of scheduling the skill', () => {
  const problems = getProblemsForSkill('CNT-12');

  it('has real problems to choose from', () => {
    expect(problems.length).toBeGreaterThan(1);
  });

  it('never serves a problem the student has already seen', () => {
    const seen = problems.map((p) => p.id);
    expect(pickProblem({ problems, seenProblemIds: seen, ceiling: 5 })).toBeNull();
  });

  it('serves an unseen problem when one exists', () => {
    const seen = [problems[0]?.id ?? ''];
    const picked = pickProblem({ problems, seenProblemIds: seen, ceiling: 5 });
    expect(picked).not.toBeNull();
    expect(seen).not.toContain(picked?.id);
  });

  it('never serves above the ceiling', () => {
    for (const ceiling of [3, 4, 5] as const) {
      const picked = pickProblem({ problems, seenProblemIds: [], ceiling });
      if (picked) expect(picked.points, `ceiling ${ceiling}`).toBeLessThanOrEqual(ceiling);
    }
  });

  it('prefers the hardest problem the student has earned', () => {
    const picked = pickProblem({ problems, seenProblemIds: [], ceiling: 5 });
    const highest = Math.max(...problems.filter((p) => p.points <= 5).map((p) => p.points));
    expect(picked?.points).toBe(highest);
  });

  it('is deterministic, so two students with the same history get the same item', () => {
    const first = pickProblem({ problems, seenProblemIds: [], ceiling: 4 });
    const second = pickProblem({ problems, seenProblemIds: [], ceiling: 4 });
    expect(first?.id).toBe(second?.id);
  });

  it('returns null rather than repeating an item when the skill is exhausted at the ceiling', () => {
    const threePointers = problems.filter((p) => p.points === 3).map((p) => p.id);
    expect(pickProblem({ problems, seenProblemIds: threePointers, ceiling: 3 })).toBeNull();
  });
});

describe('the drill loop end to end', () => {
  it('a missed skill on Monday comes back within the week with a different problem', () => {
    // docs/02-BUILD-PLAN.md M2.6's acceptance, expressed as a test of the two pieces it rests on.
    const monday = new Date('2026-03-02T09:00:00Z');
    const problems = getProblemsForSkill('CNT-12');
    const first = pickProblem({ problems, seenProblemIds: [], ceiling: 3 });
    expect(first).not.toBeNull();

    const card = reviewSkill(
      newSkillCard(monday),
      ratingFor({ correct: false, hintsUsed: 0 }),
      monday,
    );
    const daysUntilDue = (card.due.getTime() - monday.getTime()) / 86_400_000;
    expect(daysUntilDue).toBeLessThanOrEqual(7);

    const second = pickProblem({
      problems,
      seenProblemIds: [first?.id ?? ''],
      ceiling: 3,
    });
    // Either a different problem, or null - never the same one again.
    expect(second?.id).not.toBe(first?.id);
  });
});
