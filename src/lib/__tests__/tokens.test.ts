import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, extractTokenBlock, parseHex } from '../contrast.ts';

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

const light = extractTokenBlock(css, ':root');
const darkSystem = extractTokenBlock(css, ":root:not([data-theme='light'])");
const darkExplicit = extractTokenBlock(css, ":root[data-theme='dark']");

/** Tokens that hold a color and must therefore exist in the light palette. */
const COLOR_TOKENS = [
  '--paper',
  '--surface',
  '--surface-2',
  '--ink',
  '--ink-2',
  '--ink-3',
  '--rule',
  '--rule-2',
  '--accent',
  '--accent-2',
  '--accent-soft',
  '--grid',
  '--p3',
  '--p3-bg',
  '--p4',
  '--p4-bg',
  '--p5',
  '--p5-bg',
  '--focus',
] as const;

/** [foreground, background, minimum ratio, why] */
const PAIRS: Array<[string, string, number, string]> = [
  ['--ink', '--paper', 7, 'body text on the page (AAA, because problem statements are long)'],
  ['--ink', '--surface', 7, 'body text on a card'],
  ['--ink-2', '--paper', 4.5, 'secondary text'],
  ['--ink-3', '--paper', 4.5, 'metadata and IDs'],
  ['--ink-3', '--surface-2', 4.5, 'metadata inside an inset well'],
  ['--accent', '--paper', 4.5, 'links'],
  ['--accent', '--surface', 4.5, 'links on a card'],
  ['--accent-2', '--paper', 4.5, 'link hover'],
  ['--focus', '--paper', 3, 'focus ring against the page'],
  ['--focus', '--surface', 3, 'focus ring against a card'],
  ['--rule-2', '--paper', 3, 'input borders (non-text UI boundary)'],
  ['--p3', '--p3-bg', 4.5, '3-point pill text'],
  ['--p4', '--p4-bg', 4.5, '4-point pill text'],
  ['--p5', '--p5-bg', 4.5, '5-point pill text'],
  ['--p3', '--paper', 4.5, '3-point color used as text on the page'],
  ['--p4', '--paper', 4.5, '4-point color used as text on the page'],
  ['--p5', '--paper', 4.5, '5-point color used as text on the page'],
];

describe('tokens.css', () => {
  it('defines every color token in the light palette on bare :root', () => {
    for (const token of COLOR_TOKENS) {
      expect(light[token], `${token} missing from :root`).toBeDefined();
      expect(parseHex(light[token] ?? ''), `${token} is not a hex color`).not.toBeNull();
    }
  });

  it('redefines the dark palette in both the media query and the explicit selector', () => {
    expect(Object.keys(darkSystem).length).toBeGreaterThan(0);
    expect(Object.keys(darkExplicit).length).toBeGreaterThan(0);
  });

  it('keeps the two dark blocks identical, so the toggle wins in both directions', () => {
    for (const [token, value] of Object.entries(darkSystem)) {
      expect(darkExplicit[token], `${token} differs between the dark blocks`).toBe(value);
    }
    for (const token of Object.keys(darkExplicit)) {
      expect(darkSystem[token], `${token} is missing from the dark media query`).toBeDefined();
    }
  });

  it('never introduces a token that exists only in dark', () => {
    for (const token of Object.keys(darkExplicit)) {
      if (!token.startsWith('--shadow')) {
        expect(light[token], `${token} has no light-theme definition`).toBeDefined();
      }
    }
  });

  describe.each([
    ['light', light],
    ['dark', { ...light, ...darkExplicit }],
  ])('%s theme meets WCAG 2.1 AA', (_theme, palette) => {
    it.each(PAIRS)('%s on %s >= %s:1 (%s)', (fg, bg, min) => {
      const ratio = contrastRatio(palette[fg] ?? '', palette[bg] ?? '');
      expect(Number.isNaN(ratio)).toBe(false);
      expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(min);
    });
  });
});
