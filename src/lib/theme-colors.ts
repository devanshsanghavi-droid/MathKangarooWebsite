import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractTokenBlock } from './contrast';

/**
 * Build-time reader for the light palette.
 *
 * A web manifest is JSON consumed by the operating system, so it cannot reference a CSS
 * custom property - it needs literal colours. Rather than writing those literals a second
 * time and letting them drift, this reads them out of src/styles/tokens.css at build time.
 * tokens.css stays the only place a colour is defined.
 */
let cached: Record<string, string> | null = null;

function lightPalette(): Record<string, string> {
  if (cached) return cached;
  const css = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8');
  cached = extractTokenBlock(css, ':root');
  return cached;
}

/** Returns the literal value of a light-theme token, e.g. themeColor('--ground'). */
export function themeColor(token: string): string {
  const value = lightPalette()[token];
  if (!value) {
    throw new Error(
      `${token} is not defined in src/styles/tokens.css. Colours must exist there before they can be used.`,
    );
  }
  return value;
}
