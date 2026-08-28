/**
 * WCAG 2.1 relative luminance and contrast ratio.
 *
 * Used by the token test, which reads src/styles/tokens.css and fails the build if any
 * text/background pair in either theme drops below AA. Accessibility is not a phase, so the
 * palette has to prove itself on every run rather than on a manual audit.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Accepts #rgb, #rrggbb and #rrggbbaa (alpha ignored). Returns null if unparseable. */
export function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '');
  const expand = (s: string): string =>
    s.length === 3 || s.length === 4
      ? s
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : s.slice(0, 6);
  if (!/^[0-9a-fA-F]{3,8}$/.test(hex)) return null;
  const full = expand(hex);
  if (full.length !== 6) return null;
  const int = Number.parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return Number.NaN;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [light, dark] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

/** CSS comments are stripped before any block lookup: a selector quoted inside the header
 * comment must never be mistaken for the rule it documents. */
export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pull the custom-property declarations out of the rule block opened by `selector`.
 * Deliberately simple: tokens.css is hand-maintained and flat, so a real CSS parser would
 * be a dependency bought for nothing.
 */
export function extractTokenBlock(css: string, selector: string): Record<string, string> {
  const source = stripCssComments(css);
  const needle = selector.replace(/\s*\{\s*$/, '').trim();
  const opener = new RegExp(`${escapeRegExp(needle)}\\s*\\{`).exec(source);
  if (!opener) return {};

  const open = opener.index + opener[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return {};

  const body = source.slice(open + 1, end);
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = match[1];
    const value = match[2];
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}
