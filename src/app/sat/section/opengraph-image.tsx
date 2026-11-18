import {
  EXAM_RUNNER_OG_SIZE,
  testExamOgAlt,
  testExamOgImage,
} from '@/components/exam-runner/exam-og';

export const size = EXAM_RUNNER_OG_SIZE;
export const contentType = 'image/png';
export const alt = testExamOgAlt('SAT', 'section');

export default function OpenGraphImage() {
  return testExamOgImage('SAT', 'section');
}
