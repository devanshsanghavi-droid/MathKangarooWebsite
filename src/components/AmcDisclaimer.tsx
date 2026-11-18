import { AMC_DISCLAIMER } from '@/lib/site';
import { TrademarkNotice } from './TrademarkNotice';

/**
 * The MAA trademark notice docs/06-V3-REDESIGN.md §2 requires on every page under /amc, on
 * top of the Math Kangaroo disclaimer the footer carries everywhere. src/app/amc/layout.tsx
 * renders it after the page content, so it sits directly above the footer. The string lives
 * in lib/site.ts so it has exactly one definition.
 */
export function AmcDisclaimer() {
  return <TrademarkNotice text={AMC_DISCLAIMER} />;
}
