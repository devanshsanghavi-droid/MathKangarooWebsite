import { cx } from '@/components/ui';

/**
 * The site's kangaroo (docs/08 item 6): an original drawing made of a few plain shapes, not
 * based on any logo. Decorative only, so it is hidden from assistive technology; whatever it
 * points at is always said in text beside it. Colours come from the decorative amber tint
 * tokens, which are defined for both themes in tokens.css.
 */
export function Mascot({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cx('block', className)}
    >
      {/* Tail */}
      <path
        d="M20 46 C 10 50, 5 56, 2 60"
        fill="none"
        stroke="var(--amber-500)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Feet */}
      <ellipse cx="36" cy="57" rx="12" ry="3.5" fill="var(--amber-700)" />
      {/* Body */}
      <ellipse cx="30" cy="40" rx="13" ry="16" fill="var(--amber-500)" />
      {/* Tummy */}
      <ellipse cx="34" cy="43" rx="7" ry="10" fill="var(--amber-100)" />
      {/* Arm */}
      <ellipse
        cx="41"
        cy="33"
        rx="2.5"
        ry="5.5"
        transform="rotate(-30 41 33)"
        fill="var(--amber-700)"
      />
      {/* Ears */}
      <ellipse
        cx="37"
        cy="9"
        rx="2.8"
        ry="6.5"
        transform="rotate(-15 37 9)"
        fill="var(--amber-500)"
      />
      <ellipse
        cx="43"
        cy="8"
        rx="2.8"
        ry="6.5"
        transform="rotate(10 43 8)"
        fill="var(--amber-500)"
      />
      <ellipse cx="43" cy="9" rx="1.2" ry="4" transform="rotate(10 43 9)" fill="var(--amber-100)" />
      {/* Head and snout */}
      <ellipse cx="41" cy="20" rx="9" ry="8" fill="var(--amber-500)" />
      <ellipse cx="48.5" cy="22.5" rx="6" ry="4.5" fill="var(--amber-500)" />
      {/* Eye, nose and smile */}
      <circle cx="44" cy="18" r="1.7" fill="var(--ink)" />
      <circle cx="54" cy="21.5" r="1.4" fill="var(--ink)" />
      <path
        d="M49 25.5 q 2.5 1.6 4.5 0"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
