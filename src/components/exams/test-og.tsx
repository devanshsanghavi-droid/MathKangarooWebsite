import type { ImageResponse } from 'next/og';
import { getTestCounts, getTestProblem, getTestSkill } from '@/lib/test-content';
import { TEST_DIFFICULTY_LABEL, type StdTest } from '@/lib/test-schemas';
import { EXAM_OG_SIZE, examOgImage } from './exam-og';
import { TEST_AREAS } from './test-area';

export const TEST_OG_SIZE = EXAM_OG_SIZE;

export function testOgAlt(test: StdTest): string {
  return `Kangaroo Atlas ${TEST_AREAS[test].name}: original practice questions`;
}

/** The share card for one SAT or ACT page: the shared exam card with the area's notice. */
export function testOgImage(
  test: StdTest,
  page: 'home' | 'problems' | 'practice' | { problemId: string },
): ImageResponse {
  const area = TEST_AREAS[test];
  const base = { badge: area.name, notice: area.ogNotice };
  const total = getTestCounts(test).total;
  if (page === 'home') {
    return examOgImage({
      ...base,
      kicker: `${area.name} practice`,
      title: `Original questions by ${area.sectionNoun} and skill`,
      detail: `${total} questions, timed mock and section tests, every mistake explained`,
    });
  }
  if (page === 'problems') {
    return examOgImage({
      ...base,
      kicker: `${area.name} question bank`,
      title: `Filter by ${area.sectionNoun}, skill, difficulty and status`,
      detail: `${total} original questions`,
    });
  }
  if (page === 'practice') {
    return examOgImage({
      ...base,
      kicker: `${area.name} practice set`,
      title: 'Check each answer and read the mistake behind a wrong one',
    });
  }
  const problem = getTestProblem(page.problemId);
  if (!problem || problem.test !== test) {
    return examOgImage({ ...base, kicker: `${area.short} question`, title: area.name });
  }
  return examOgImage({
    ...base,
    kicker: `${problem.id}, ${area.name}`,
    title: getTestSkill(test, problem.skill)?.skill.name ?? problem.skill,
    detail: TEST_DIFFICULTY_LABEL[problem.difficulty],
  });
}
