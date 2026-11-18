import type { ImageResponse } from 'next/og';
import { EXAM_OG_SIZE, examOgImage } from '@/components/exams/exam-og';

export const AMC_OG_SIZE = EXAM_OG_SIZE;
export const AMC_OG_ALT = 'Kangaroo Atlas AMC beta: original AMC 8, AMC 10 and AMC 12 practice';

/**
 * The share card for every route under /amc: the shared exam card (exam-og.tsx) with the AMC
 * beta pill and the MAA notice in short.
 */
export function amcOgImage({
  kicker,
  title,
  detail,
}: {
  kicker: string;
  title: string;
  detail?: string;
}): ImageResponse {
  return examOgImage({
    badge: 'AMC beta',
    kicker,
    title,
    ...(detail ? { detail } : {}),
    notice: 'Independent. Not affiliated with the MAA.',
  });
}
