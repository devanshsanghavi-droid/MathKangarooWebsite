import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

export default function OpenGraphImage() {
  return amcOgImage({
    kicker: 'AMC practice set',
    title: 'Check each answer and read the mistake behind a wrong one',
  });
}
