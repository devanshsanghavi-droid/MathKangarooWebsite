import {
  EXAM_RUNNER_OG_SIZE,
  KA_SECTION_OG_ALT,
  kaSectionOgImage,
} from '@/components/exam-runner/exam-og';

export const size = EXAM_RUNNER_OG_SIZE;
export const contentType = 'image/png';
export const alt = KA_SECTION_OG_ALT;

export default function OpenGraphImage() {
  return kaSectionOgImage();
}
