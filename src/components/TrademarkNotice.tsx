/**
 * An exam area's trademark notice, rendered by that area's layout after the page content so
 * it sits directly above the footer, on top of the Math Kangaroo disclaimer the footer
 * carries everywhere. /amc passes AMC_DISCLAIMER, /sat SAT_DISCLAIMER and /act ACT_DISCLAIMER
 * (lib/site.ts holds each string once, docs/07 section 1).
 */
export function TrademarkNotice({ text }: { text: string }) {
  return (
    <div className="mx-auto w-full max-w-app px-4 pb-6 sm:px-6">
      <p
        role="note"
        aria-label="Trademark notice"
        className="ui m-0 rounded-card border border-rule bg-surface-2 px-4 py-3 text-xs font-medium text-ink-2"
      >
        {text}
      </p>
    </div>
  );
}
