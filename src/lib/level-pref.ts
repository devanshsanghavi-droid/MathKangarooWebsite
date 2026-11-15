import { BANDS, type Band } from './schemas';

/**
 * The level a student told the Practice home they sit, remembered in this browser only.
 *
 * A per-viewer convenience, nothing more: it chooses which level the quick starts draw from and
 * which level card is highlighted. It is never sent anywhere, and losing it (a private window,
 * cleared site data) just means the picker asks again.
 */
export const LEVEL_KEY = 'ka-level';
export const LEVEL_EVENT = 'ka:level';

export function parseLevel(raw: string | null | undefined): Band | null {
  return raw && (BANDS as readonly string[]).includes(raw) ? (raw as Band) : null;
}

/** Holds the choice for this page view when storage is blocked. */
let memory: Band | null = null;

export function readLevel(): Band | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseLevel(window.localStorage.getItem(LEVEL_KEY)) ?? memory;
  } catch {
    return memory;
  }
}

export function writeLevel(band: Band): void {
  if (typeof window === 'undefined') return;
  memory = band;
  try {
    window.localStorage.setItem(LEVEL_KEY, band);
  } catch {
    // Blocked storage: the choice still applies for this page view through the event below.
  }
  window.dispatchEvent(new CustomEvent(LEVEL_EVENT, { detail: band }));
}

/** "Level 5-6", with a plain hyphen. */
export function levelLabel(band: Band): string {
  return `Level ${band}`;
}

/** Exported for tests, which need a clean slate between cases. */
export function resetLevelMemory(): void {
  memory = null;
}
