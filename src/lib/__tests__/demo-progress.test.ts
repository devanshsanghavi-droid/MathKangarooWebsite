import { describe, it, expect } from 'vitest';
import { demoProgress, isDemoSearch, seededRandom } from '../demo-progress';
import { cleanAttempt, cleanSession, parseProgress } from '../local-progress';
import { examAnswers, examFilterCounts, sessionReviewIds } from '../progress-analytics';
import { progressBanks } from '../progress-page-data';
import { demoKaProblems } from '../../app/progress/demo-pool';

const NOW = new Date(2026, 10, 18, 15);
const banks = progressBanks();
const kaProblems = demoKaProblems();

describe('demo student', () => {
  const file = demoProgress({ banks, kaProblems, now: NOW });

  it('is deterministic', () => {
    expect(demoProgress({ banks, kaProblems, now: NOW })).toEqual(file);
    expect(seededRandom(1)()).toBe(seededRandom(1)());
  });

  it('covers 8 weeks and nothing after now', () => {
    const times = Object.values(file.attempts)
      .flat()
      .map((a) => Date.parse(a.at));
    expect(Math.max(...times)).toBeLessThanOrEqual(NOW.getTime());
    expect(Math.min(...times)).toBeGreaterThan(NOW.getTime() - 57 * 86_400_000);
  });

  it('is a valid progress file that survives a parse', () => {
    for (const a of Object.values(file.attempts).flat()) expect(cleanAttempt(a)).toEqual(a);
    for (const s of file.sessions ?? []) expect(cleanSession(s)).toEqual(s);
    expect(parseProgress(JSON.stringify(file)).sessions).toHaveLength(file.sessions?.length ?? 0);
  });

  it('uses only real problem ids from the build-time data', () => {
    const known = new Set([...banks.flatMap((b) => b.groups.flatMap((g) => g.ids))]);
    for (const a of Object.values(file.attempts).flat()) expect(known.has(a.problemId)).toBe(true);
  });

  it('has timed practice and test answers across Kangaroo, AMC 8 and AMC 10 only', () => {
    const counts = examFilterCounts(file, banks);
    expect(counts.ka.answers).toBeGreaterThan(50);
    expect(counts.amc8.tests).toBeGreaterThanOrEqual(3);
    expect(counts.amc10.tests).toBeGreaterThanOrEqual(2);
    expect(counts.amc12).toEqual({ answers: 0, tests: 0 });
    expect(counts.sat).toEqual({ answers: 0, tests: 0 });
    const answers = examAnswers(file, banks, 'all');
    expect(answers.every((a) => typeof a.ms === 'number')).toBe(true);
    expect(new Set(answers.map((a) => a.mode))).toEqual(new Set(['practice', 'test']));
  });

  it('improves: each exam scores better on its last test than its first', () => {
    for (const exam of ['KA', 'AMC8', 'AMC10'] as const) {
      const mocks = (file.sessions ?? []).filter((s) => s.exam === exam && s.kind === 'mock');
      const first = mocks[0];
      const last = mocks.at(-1);
      expect(first && last && last.score / last.max > first.score / first.max, exam).toBe(true);
    }
  });

  it('lets every test be reviewed from its own answers', () => {
    for (const s of file.sessions ?? []) {
      expect(sessionReviewIds(file, s).length, `${s.exam} ${s.at}`).toBe(
        Math.min(50, s.total - (s.exam === 'AMC10' && s.kind === 'mock' ? 3 : 0)),
      );
    }
  });

  it('reads ?demo=1 only', () => {
    expect(isDemoSearch('?demo=1')).toBe(true);
    expect(isDemoSearch('?exam=ka&demo=1')).toBe(true);
    expect(isDemoSearch('?demo=0')).toBe(false);
    expect(isDemoSearch('')).toBe(false);
  });
});
