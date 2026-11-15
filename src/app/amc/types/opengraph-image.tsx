import { getAmcTaxonomy } from '@/lib/amc-content';
import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

export default function OpenGraphImage() {
  return amcOgImage({
    kicker: 'AMC problem types',
    title: 'The recurring competition patterns, and how to spot each one',
    detail: `${getAmcTaxonomy().types.length} types, from complementary counting to power of a point`,
  });
}
