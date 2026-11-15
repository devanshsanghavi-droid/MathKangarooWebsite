import { AMC_DISCLAIMER } from '@/lib/site';

/**
 * The MAA trademark notice docs/06-V3-REDESIGN.md §2 requires on every page under /amc, on
 * top of the Math Kangaroo disclaimer the footer carries everywhere. src/app/amc/layout.tsx
 * renders it after the page content, so it sits directly above the footer. The string lives
 * in lib/site.ts so it has exactly one definition.
 */
export function AmcDisclaimer() {
  return (
    <div className="mx-auto w-full max-w-app px-4 pb-6 sm:px-6">
      <p
        role="note"
        aria-label="Trademark notice"
        className="ui m-0 rounded-card border border-rule bg-surface-2 px-4 py-3 text-xs font-medium text-ink-2"
      >
        {AMC_DISCLAIMER}
      </p>
    </div>
  );
}
