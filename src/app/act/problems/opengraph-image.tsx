import { TEST_OG_SIZE, testOgAlt, testOgImage } from '@/components/exams/test-og';

export const size = TEST_OG_SIZE;
export const contentType = 'image/png';
export const alt = testOgAlt('ACT');

export default function OpenGraphImage() {
  return testOgImage('ACT', 'problems');
}
