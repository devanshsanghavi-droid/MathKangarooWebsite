import { getAmcCounts } from '@/lib/amc-content';
import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

export default function OpenGraphImage() {
  const counts = getAmcCounts();
  return amcOgImage({
    kicker: 'AMC 8, AMC 10 and AMC 12 practice',
    title: 'Original problems organised by area, topic and problem type',
    detail: `${counts.total} problems, a must-know formula sheet and flashcards`,
  });
}
