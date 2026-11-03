import { describe, it, expect } from 'vitest';
import {
  buildPaper,
  countBlanks,
  countFlagged,
  formatClock,
  isExpired,
  itemsPerTier,
  maxScore,
  MOCK_DURATION_MS,
  NUDGE_AT_MS,
  paperSize,
  remainingMs,
  scoreMock,
  shouldNudge,
  startMock,
  type MockState,
} from '../mock';
import { getAllProblems } from '../content';
import { BANDS, type Band } from '../schemas';

const problems = getAllProblems();
const NOW = new Date('2026-03-01T09:00:00Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe('paper structure - docs/01-DATA-MODEL.md §3.5', () => {
  it('uses 24 items out of 96 for the lower bands', () => {
    for (const band of ['1-2', '3-4'] as const) {
      expect(itemsPerTier(band)).toBe(8);
      expect(paperSize(band)).toBe(24);
      expect(maxScore(band)).toBe(96);
    }
  });

  it('uses 30 items out of 120 for everything above', () => {
    for (const band of ['5-6', '7-8', '9-10', '11-12'] as const) {
      expect(itemsPerTier(band)).toBe(10);
      expect(paperSize(band)).toBe(30);
      expect(maxScore(band)).toBe(120);
    }
  });
});

describe('building the paper', () => {
  it('draws exact thirds at 3, 4 and 5 points', () => {
    const { problemIds, shortfall } = buildPaper(problems, '5-6', 1);
    expect(shortfall).toEqual([]);
    const byId = new Map(problems.map((p) => [p.id, p]));
    const counts: Record<number, number> = { 3: 0, 4: 0, 5: 0 };
    for (const id of problemIds) {
      const points = byId.get(id)?.points;
      if (points) counts[points] = (counts[points] ?? 0) + 1;
    }
    expect(counts).toEqual({ 3: 10, 4: 10, 5: 10 });
  });

  it('never repeats a problem', () => {
    const { problemIds } = buildPaper(problems, '3-4', 5);
    expect(new Set(problemIds).size).toBe(problemIds.length);
  });

  it('only uses problems from the chosen band', () => {
    const byId = new Map(problems.map((p) => [p.id, p]));
    for (const id of buildPaper(problems, '3-4', 2).problemIds) {
      expect(byId.get(id)?.band).toBe('3-4');
    }
  });

  it('is deterministic for a seed, and different across seeds', () => {
    expect(buildPaper(problems, '5-6', 7).problemIds).toEqual(
      buildPaper(problems, '5-6', 7).problemIds,
    );
    expect(buildPaper(problems, '5-6', 7).problemIds).not.toEqual(
      buildPaper(problems, '5-6', 8).problemIds,
    );
  });

  it('runs easiest first, in tier order', () => {
    const byId = new Map(problems.map((p) => [p.id, p]));
    const points = buildPaper(problems, '5-6', 3).problemIds.map((id) => byId.get(id)?.points ?? 0);
    expect(points).toEqual([...points].sort((a, b) => a - b));
  });

  it('reports a shortfall rather than silently building a short paper', () => {
    // A 22-question "mock" scored out of 96 is worse than no mock: the number lies.
    //
    // The thin band is constructed, not named. This used to point at 11-12, and then at the
    // band that happened to be emptiest, both of which stopped being thin as the bank grew.
    // Holding out all but two problems of a band tests the guard itself rather than a count.
    const band = '11-12';
    const thinned = problems.filter((problem) => !(problem.band === band && problem.points === 5));
    const { shortfall } = buildPaper(thinned, band, 1);
    expect(shortfall.length).toBeGreaterThan(0);
    expect(startMock(thinned, band, 1, NOW)).toBeNull();
  });

  it('can build every band the bank covers', () => {
    for (const band of ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12'] as const) {
      expect(startMock(problems, band, 1, NOW), band).not.toBeNull();
    }
  });

  it('names which tier is short and by how much', () => {
    const { shortfall } = buildPaper(problems, '9-10', 1);
    for (const entry of shortfall) {
      expect(entry.wanted).toBe(10);
      expect(entry.available).toBeLessThan(10);
    }
  });
});

function freshRun(band: Band = '5-6'): MockState {
  const state = startMock(problems, band, 1, NOW);
  if (!state) throw new Error(`cannot build a ${band} paper`);
  return state;
}

describe('the timer survives a refresh - M2.8 acceptance', () => {
  it('starts at 75 minutes', () => {
    expect(remainingMs(freshRun(), NOW)).toBe(MOCK_DURATION_MS);
  });

  it('reports the right time left at minute 40, from a state that was reloaded', () => {
    const state = freshRun();
    const revived = JSON.parse(JSON.stringify(state)) as MockState;
    expect(remainingMs(revived, at(40))).toBe(35 * 60_000);
  });

  it('is computed from the clock, so time passes while the tab is closed', () => {
    const state = freshRun();
    expect(remainingMs(state, at(10))).toBeGreaterThan(remainingMs(state, at(60)));
  });

  it('floors at zero rather than going negative', () => {
    const state = freshRun();
    expect(remainingMs(state, at(200))).toBe(0);
    expect(isExpired(state, at(76))).toBe(true);
    expect(isExpired(state, at(74))).toBe(false);
  });

  it('reports no time left once submitted, whatever the clock says', () => {
    const state = { ...freshRun(), finishedAt: NOW.toISOString() };
    expect(remainingMs(state, NOW)).toBe(0);
  });

  it('formats the clock as minutes and seconds', () => {
    expect(formatClock(75 * 60_000)).toBe('75:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(-1)).toBe('0:00');
  });
});

describe('the no-blanks nudge', () => {
  it('fires in the last five minutes when something is blank', () => {
    const state = freshRun();
    expect(shouldNudge(state, at(69))).toBe(false);
    expect(shouldNudge(state, at(71))).toBe(true);
  });

  it('does not fire when every question is answered', () => {
    const state = freshRun();
    for (const id of state.problemIds) {
      const answer = state.answers[id];
      if (answer) answer.chosenKey = 'A';
    }
    expect(countBlanks(state)).toBe(0);
    expect(shouldNudge(state, at(71))).toBe(false);
  });

  it('does not fire after the paper is over', () => {
    const state = { ...freshRun(), finishedAt: at(75).toISOString() };
    expect(shouldNudge(state, at(74))).toBe(false);
  });

  it('nudges at exactly five minutes left, not four', () => {
    const state = freshRun();
    const fiveLeft = new Date(NOW.getTime() + MOCK_DURATION_MS - NUDGE_AT_MS);
    expect(shouldNudge(state, fiveLeft)).toBe(true);
  });
});

describe('flags and counts', () => {
  it('counts blanks and flags', () => {
    const state = freshRun();
    const [first, second] = state.problemIds;
    if (!first || !second) throw new Error('empty paper');
    const a = state.answers[first];
    const b = state.answers[second];
    if (a) a.chosenKey = 'B';
    if (b) b.flagged = true;
    expect(countBlanks(state)).toBe(state.problemIds.length - 1);
    expect(countFlagged(state)).toBe(1);
  });
});

describe('scoring - no deduction for a wrong answer', () => {
  function answerAll(
    state: MockState,
    chooser: (problemId: string) => 'right' | 'wrong' | 'blank',
  ) {
    const byId = new Map(problems.map((p) => [p.id, p]));
    for (const id of state.problemIds) {
      const problem = byId.get(id);
      const answer = state.answers[id];
      if (!problem || !answer) continue;
      const verdict = chooser(id);
      if (verdict === 'blank') continue;
      const correct = problem.choices.find((c) => c.correct);
      const wrong = problem.choices.find((c) => !c.correct);
      answer.chosenKey = verdict === 'right' ? (correct?.key ?? null) : (wrong?.key ?? null);
      answer.msSpent = 60_000;
    }
    return state;
  }

  it('gives full marks for a perfect paper', () => {
    const report = scoreMock(
      problems,
      answerAll(freshRun(), () => 'right'),
    );
    expect(report.score).toBe(120);
    expect(report.maxScore).toBe(120);
    expect(report.blanks).toBe(0);
  });

  it('gives zero for an all-wrong paper, and never a negative score', () => {
    const report = scoreMock(
      problems,
      answerAll(freshRun(), () => 'wrong'),
    );
    expect(report.score).toBe(0);
    expect(report.blanks).toBe(0);
  });

  it('scores a blank exactly the same as a wrong answer', () => {
    const wrong = scoreMock(
      problems,
      answerAll(freshRun(), () => 'wrong'),
    ).score;
    const blank = scoreMock(
      problems,
      answerAll(freshRun(), () => 'blank'),
    ).score;
    expect(wrong).toBe(blank);
  });

  it('reports what the blanks cost, which is the argument for guessing', () => {
    const report = scoreMock(
      problems,
      answerAll(freshRun(), () => 'blank'),
    );
    expect(report.blanks).toBe(30);
    expect(report.blankCost).toBe(120);
  });

  it('breaks the score down by point tier', () => {
    const report = scoreMock(
      problems,
      answerAll(freshRun(), () => 'right'),
    );
    expect(report.tiers.map((tier) => tier.asked)).toEqual([10, 10, 10]);
    expect(report.tiers.map((tier) => tier.scored)).toEqual([30, 40, 50]);
  });

  it('produces one scatter point per question, with time and outcome', () => {
    const report = scoreMock(
      problems,
      answerAll(freshRun(), () => 'right'),
    );
    expect(report.scatter).toHaveLength(30);
    expect(report.scatter.every((point) => point.seconds === 60)).toBe(true);
    expect(report.scatter.every((point) => point.correct)).toBe(true);
  });

  it('ranks the skills worst first and names three to fix', () => {
    const report = scoreMock(
      problems,
      answerAll(freshRun(), () => 'wrong'),
    );
    expect(report.topFixes).toHaveLength(3);
    const first = report.skills[0];
    const last = report.skills.at(-1);
    if (first && last) {
      expect(first.correct / first.asked).toBeLessThanOrEqual(last.correct / last.asked);
    }
  });

  it('names nothing to fix on a perfect paper', () => {
    expect(
      scoreMock(
        problems,
        answerAll(freshRun(), () => 'right'),
      ).topFixes,
    ).toEqual([]);
  });

  it('counts a skill once per question that tags it, primary or secondary', () => {
    const report = scoreMock(
      problems,
      answerAll(freshRun(), () => 'right'),
    );
    const total = report.skills.reduce((n, heat) => n + heat.asked, 0);
    expect(total).toBeGreaterThanOrEqual(30);
  });
});

describe('the state is plain JSON', () => {
  it('round-trips unchanged, so localStorage is enough', () => {
    const state = freshRun();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('scores identically after a round trip', () => {
    const state = freshRun();
    const revived = JSON.parse(JSON.stringify(state)) as MockState;
    expect(scoreMock(problems, revived)).toEqual(scoreMock(problems, state));
  });
});

describe('every band is either buildable or honestly refused', () => {
  it.each(BANDS)('%s', (band) => {
    const state = startMock(problems, band, 1, NOW);
    if (state === null) {
      expect(buildPaper(problems, band, 1).shortfall.length).toBeGreaterThan(0);
    } else {
      expect(state.problemIds).toHaveLength(paperSize(band));
    }
  });
});
