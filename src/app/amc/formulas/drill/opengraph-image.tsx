import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

export default function OpenGraphImage() {
  return amcOgImage({
    kicker: 'AMC formula flashcards',
    title: 'Spaced-repetition flashcards for the must-know formulas',
    detail: 'Grade yourself, and each card comes back just before you would forget it',
  });
}
