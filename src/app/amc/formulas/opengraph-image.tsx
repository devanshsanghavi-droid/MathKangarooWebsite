import { getAmcFormulas } from '@/lib/amc-content';
import { AMC_OG_ALT, AMC_OG_SIZE, amcOgImage } from '@/components/amc/amc-og';

export const size = AMC_OG_SIZE;
export const contentType = 'image/png';
export const alt = AMC_OG_ALT;

export default function OpenGraphImage() {
  const formulas = getAmcFormulas();
  const mustKnow = formulas.filter((formula) => formula.priority === 'must-know').length;
  return amcOgImage({
    kicker: 'AMC formula sheet',
    title: 'Must-know formulas, with when to use each and the usual pitfall',
    detail: `${formulas.length} formulas, ${mustKnow} of them must-know, printable`,
  });
}
