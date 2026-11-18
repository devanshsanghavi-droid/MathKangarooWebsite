import { EXAM_OG_SIZE, examOgImage } from '@/components/exams/exam-og';

export const size = EXAM_OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Kangaroo Atlas exams: Math Kangaroo, AMC 8, 10 and 12, SAT Math and ACT Math';

export default function OpenGraphImage() {
  return examOgImage({
    badge: 'Exams',
    kicker: 'Free exam practice',
    title: 'Math Kangaroo, AMC 8, 10 and 12, SAT Math and ACT Math',
    detail: 'Original problems, mock tests, every mistake explained',
    notice: 'Independent. Not affiliated with any exam body.',
  });
}
