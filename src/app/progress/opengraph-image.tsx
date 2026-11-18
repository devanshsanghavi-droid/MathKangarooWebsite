import { EXAM_OG_SIZE, examOgImage } from '@/components/exams/exam-og';

/**
 * The /progress share card. The page sets its own `openGraph` block, which stops the root
 * image from being inherited, so the route needs its own file to keep an og:image.
 */
export const size = EXAM_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Kangaroo Atlas progress: accuracy by section and over time';

export default function OpenGraphImage() {
  return examOgImage({
    badge: 'Progress',
    kicker: 'Your own numbers',
    title: 'How each section is going, and what to practise next',
    detail: 'Kangaroo, AMC, SAT and ACT, with no account needed',
    notice: 'Independent. Not affiliated with any exam body.',
  });
}
