import type { Band } from '@/lib/schemas';

/** Math Kangaroo levels are named by school-year pairs; the en dash matches the official form. */
export function bandLabel(band: Band): string {
  return `Level ${band.replace('-', '–')}`;
}

export function BandPill({ band }: { band: Band }) {
  return (
    <span className="mono inline-flex items-center rounded-xs border border-rule px-1.5 py-0.5 text-2xs text-ink-2">
      {bandLabel(band)}
    </span>
  );
}
