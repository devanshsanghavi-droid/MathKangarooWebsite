import type { ImageResponse } from 'next/og';
import { EXAM_OG_SIZE, examOgImage } from '@/components/exams/exam-og';
import { TEST_AREAS } from '@/components/exams/test-area';
import { amcOgImage } from '@/components/amc/amc-og';
import type { StdTest } from '@/lib/test-meta';
import { EXAM_SPECS, SECTION_TEST_SIZE, mockMinutes, mockQuestionCount } from '@/lib/exam-engine';

/**
 * Share cards for the mock and section-test routes: the shared exam card with each area's
 * badge and notice. Generated at build time.
 */
export const EXAM_RUNNER_OG_SIZE = EXAM_OG_SIZE;

export function testExamOgAlt(test: StdTest, kind: 'mock' | 'section'): string {
  const name = TEST_AREAS[test].name;
  return `Kangaroo Atlas ${name} ${kind === 'mock' ? 'mock test' : 'section test'}`;
}

export function testExamOgImage(test: StdTest, kind: 'mock' | 'section'): ImageResponse {
  const area = TEST_AREAS[test];
  const spec = EXAM_SPECS[test];
  return examOgImage({
    badge: area.name,
    notice: area.ogNotice,
    kicker: kind === 'mock' ? `${area.name} mock test` : `${area.name} section test`,
    title:
      kind === 'mock'
        ? `${mockQuestionCount(spec)} questions, ${mockMinutes(spec)} minutes, the real format`
        : `${SECTION_TEST_SIZE} timed questions from one ${area.sectionNoun}`,
    detail: 'Original questions, every mistake explained, no account',
  });
}

export const AMC_EXAM_OG_ALT = {
  mock: 'Kangaroo Atlas AMC mock exams: AMC 8, AMC 10 and AMC 12',
  section: 'Kangaroo Atlas AMC section tests',
} as const;

export function amcExamOgImage(kind: 'mock' | 'section'): ImageResponse {
  return kind === 'mock'
    ? amcOgImage({
        kicker: 'AMC mock exam',
        title: 'A full timed AMC 8, AMC 10 or AMC 12 paper',
        detail: '25 original problems, scored the real way',
      })
    : amcOgImage({
        kicker: 'AMC section test',
        title: `${SECTION_TEST_SIZE} timed problems from one area`,
        detail: 'Algebra, geometry, counting and probability, number theory',
      });
}

export const KA_SECTION_OG_ALT = 'Kangaroo Atlas section test: one strand at your level';

export function kaSectionOgImage(): ImageResponse {
  return examOgImage({
    badge: 'Practice',
    notice: 'Independent. Not affiliated with Math Kangaroo in USA.',
    kicker: 'Section test',
    title: `${SECTION_TEST_SIZE} timed problems from one strand at your level`,
    detail: 'Original problems, every mistake explained, no account',
  });
}
