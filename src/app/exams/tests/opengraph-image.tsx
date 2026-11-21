import { EXAM_OG_SIZE, examOgImage } from '@/components/exams/exam-og';

export const size = EXAM_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Kangaroo Atlas tests: timed mock and section tests for every exam';

export default function OpenGraphImage() {
  return examOgImage({
    badge: 'Tests',
    kicker: 'Timed practice tests',
    title: 'Mock and section tests for every exam',
    detail: 'Math Kangaroo, AMC 8, 10 and 12, SAT Math and ACT Math',
    notice: 'Independent. Not affiliated with any exam body.',
  });
}
