import { getAllProblems } from '@/lib/content';
import { getAllAmcProblems } from '@/lib/amc-content';
import type { ProgressFile } from '@/lib/local-progress';
import type { AttemptRecord } from '@/lib/mastery';

/** A progress file for the /progress page tests, built from the real content. */

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/**
 * Six answers in the strand of the first Kangaroo problem (two right), one in a second strand,
 * one AMC answer, and one finished section test. SAT and ACT stay empty.
 */
export function seededProgress(): ProgressFile {
  const first = getAllProblems()[0];
  const other = getAllProblems().find(
    (p) => p.skills.primary.slice(0, 3) !== first?.skills.primary.slice(0, 3),
  );
  const amc = getAllAmcProblems()[0];
  if (!first || !other || !amc) throw new Error('needs Kangaroo and AMC content');
  const attempts: Record<string, AttemptRecord[]> = {};
  const add = (key: string, a: AttemptRecord) => {
    (attempts[key] ??= []).push(a);
  };
  for (let i = 0; i < 6; i += 1) {
    add(first.skills.primary, {
      problemId: first.id,
      points: first.points,
      correct: i < 2,
      hintsUsed: 0,
      at: daysAgo(10 - i),
    });
  }
  add(other.skills.primary, {
    problemId: other.id,
    points: other.points,
    correct: true,
    hintsUsed: 0,
    at: daysAgo(2),
  });
  add(amc.id, { problemId: amc.id, points: 3, correct: true, hintsUsed: 0, at: daysAgo(1) });
  return {
    version: 1,
    attempts,
    sessions: [
      {
        kind: 'section',
        exam: 'KA',
        section: first.skills.primary.slice(0, 3),
        at: daysAgo(3),
        score: 6,
        max: 10,
        correct: 6,
        total: 10,
        durationMs: 9 * 60_000,
      },
    ],
  };
}
