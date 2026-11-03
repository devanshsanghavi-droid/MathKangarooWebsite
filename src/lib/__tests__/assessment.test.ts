import { describe, it, expect } from 'vitest';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { toAssessmentProblem, toAssessmentSkill } from '@/lib/assessment';
import {
  isFinished,
  nextItem,
  recordAnswer,
  startDiagnostic,
  summarise,
  type DiagnosticContent,
} from '@/lib/diagnostic';
import { buildPaper, scoreMock, startMock } from '@/lib/mock';
import { BANDS } from '@/lib/schemas';

/**
 * The diagnostic and mock pages ship a trimmed bank. These tests pin the two things that makes
 * safe: the trimmed objects really are trimmed (nothing practice-only leaks into the payload),
 * and every decision the pure logic makes is identical on the trimmed bank and the full one.
 */

const skills = getAllSkills();
const problems = getAllProblems();
const full: DiagnosticContent = { skills, problems };
const trimmed: DiagnosticContent = {
  skills: skills.map(toAssessmentSkill),
  problems: problems.map(toAssessmentProblem),
};

describe('the assessment projection', () => {
  it('keeps only what an assessment shows or the logic reads', () => {
    const sample = problems.find((problem) => problem.figure) ?? problems[0];
    expect(sample).toBeDefined();
    if (!sample) return;
    const projected = toAssessmentProblem(sample);
    expect(Object.keys(projected).sort()).toEqual(
      ['band', 'choices', 'estSeconds', 'figure', 'id', 'points', 'skills', 'statement'].sort(),
    );
    for (const choice of projected.choices) {
      expect(Object.keys(choice).sort()).toEqual(['correct', 'key', 'text']);
    }
    expect(JSON.stringify(projected)).not.toContain('misconception');
    const skill = skills[0];
    expect(skill).toBeDefined();
    if (!skill) return;
    expect(Object.keys(toAssessmentSkill(skill)).sort()).toEqual(
      ['bands', 'id', 'prerequisites', 'strand', 'tier', 'unlocks'].sort(),
    );
  });

  it('is much smaller than the bank it came from', () => {
    const before = JSON.stringify(full).length;
    const after = JSON.stringify(trimmed).length;
    expect(after).toBeLessThan(before / 2);
  });
});

describe('the diagnostic on the trimmed bank', () => {
  // A fixed answer pattern that mixes solves and misses, so both branches of the graph walk run.
  const pattern = (index: number) => index % 3 !== 1;

  for (const band of BANDS) {
    it(`asks the same questions and gives the same plan at level ${band}`, () => {
      let a = startDiagnostic(full, band);
      let b = startDiagnostic(trimmed, band);
      expect(b).toEqual(a);
      for (let index = 0; index < 40 && !isFinished(a); index += 1) {
        const pa = nextItem(full, a);
        const pb = nextItem(trimmed, b);
        expect(pb?.id).toEqual(pa?.id);
        if (!pa || !pb) break;
        a = recordAnswer(full, a, pa, pattern(index));
        b = recordAnswer(trimmed, b, pb, pattern(index));
        expect(b).toEqual(a);
      }
      expect(summarise(trimmed, b)).toEqual(summarise(full, a));
    });
  }
});

describe('the mock on the trimmed bank', () => {
  const now = new Date('2026-03-01T10:00:00Z');

  for (const band of BANDS) {
    it(`builds and scores the same paper at level ${band}`, () => {
      const small = trimmed.problems;
      expect(buildPaper(small, band, 7)).toEqual(buildPaper(problems, band, 7));
      const a = startMock(problems, band, 7, now);
      const b = startMock(small, band, 7, now);
      expect(b).toEqual(a);
      if (!a) return;
      // Answer every question "A" so right, wrong and (by leaving the last blank) blank all occur.
      const answered = {
        ...a,
        finishedAt: now.toISOString(),
        answers: Object.fromEntries(
          a.problemIds.map((id, index) => [
            id,
            {
              problemId: id,
              chosenKey: index === a.problemIds.length - 1 ? null : ('A' as const),
              flagged: false,
              msSpent: 30_000,
            },
          ]),
        ),
      };
      expect(scoreMock(small, answered)).toEqual(scoreMock(problems, answered));
    });
  }
});
