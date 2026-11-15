/** Clamped 0-100 percentage. A zero or negative max reads as 0%, never NaN. */
export function percentOf(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

/** "3 of 12 solved" - the default spoken value for a progress indicator. */
export function progressValueText(value: number, max: number, unit = 'solved'): string {
  return `${value} of ${max}${unit ? ` ${unit}` : ''}`;
}
