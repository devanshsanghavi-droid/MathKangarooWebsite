/**
 * Line icons for the five v3 destinations (docs/06 §2), drawn in currentColor so they follow
 * the link's ink in both themes and print black. Always decorative: the label beside each one
 * is the accessible name.
 */
const PATHS: Record<string, string> = {
  // Practice: a target.
  '/': 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 3.25a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Zm0 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z',
  // Question bank: a list.
  '/problems': 'M7 5.5h9M7 10h9M7 14.5h9M3.75 5.5h.5M3.75 10h.5M3.75 14.5h.5',
  // Skill Atlas: three linked nodes.
  '/atlas':
    'M5 15.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM15 15.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5ZM10 7.5A1.75 1.75 0 1 0 10 4a1.75 1.75 0 0 0 0 3.5ZM9 7.2 6 12.3M11 7.2l3 5.1M6.75 13.75h6.5',
  // Past papers: a page with lines.
  '/papers': 'M5.5 3h6.25L15 6.25V17H5.5V3ZM11.5 3v3.5H15M8 10h4.5M8 13h4.5',
  // AMC: a summation sign. (It was a triangle with a bar and a dot, which reads as a warning
  // sign, the wrong message beside a nav item.)
  '/amc': 'M14.5 4.5h-9l5 5.5-5 5.5h9',
};

export function NavIcon({ href, className }: { href: string; className?: string }) {
  const d = PATHS[href];
  if (!d) return null;
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The wordmark glyph: a small Atlas lattice on a teal tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" className={className}>
      <rect width="28" height="28" rx="8" className="fill-accent-600" />
      <path
        d="M8.5 19 14 9l5.5 10M10.5 15.5h7"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-on-accent"
      />
    </svg>
  );
}
