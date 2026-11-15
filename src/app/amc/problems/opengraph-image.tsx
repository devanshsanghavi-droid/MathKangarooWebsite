import { getAmcCounts } from '@/lib/amc-content';
import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

export default function OpenGraphImage() {
  return amcOgImage({
    kicker: 'AMC problem bank',
    title: 'Filter by contest, topic, problem type and paper position',
    detail: `${getAmcCounts().total} original problems, every wrong answer explained`,
  });
}
