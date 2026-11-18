import {
  AMC_EXAM_OG_ALT,
  EXAM_RUNNER_OG_SIZE,
  amcExamOgImage,
} from '@/components/exam-runner/exam-og';

export const size = EXAM_RUNNER_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_EXAM_OG_ALT.section;

export default function OpenGraphImage() {
  return amcExamOgImage('section');
}
