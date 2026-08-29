import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, extractTokenBlock, parseHex, relativeLuminance } from '../contrast.ts';

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

const light = extractTokenBlock(css, ':root');
const darkSystem = extractTokenBlock(css, ":root:not([data-theme='light'])");
const darkExplicit = extractTokenBlock(css, ":root[data-theme='dark']");

/**
 * The palette proves itself on every run rather than on a manual audit — CLAUDE.md,
 * "accessibility is not a phase". Extended for v2 (docs/05-DESIGN-DIRECTION.md §10.3): every
 * difficulty pair, every mastery step, and every reserved feedback colour on its own tint.
 */

/** Tokens that hold a color and must therefore exist in the light palette. */
const COLOR_TOKENS = [
  '--ground',
  '--surface',
  '--surface-2',
  '--surface-3',
  '--ink',
  '--ink-2',
  '--ink-3',
  '--rule',
  '--rule-strong',
  '--grid',
  '--accent-700',
  '--accent-600',
  '--accent-500',
  '--accent-100',
  '--correct-700',
  '--correct-600',
  '--correct-100',
  '--correct-border',
  '--wrong-700',
  '--wrong-600',
  '--wrong-100',
  '--wrong-border',
  '--hint-700',
  '--hint-100',
  '--hint-border',
  '--d1-bg',
  '--d1-fg',
  '--d2-bg',
  '--d2-fg',
  '--d3-bg',
  '--d3-fg',
  '--m0',
  '--m1',
  '--m2',
  '--m3',
  '--focus',
] as const;

/** The tokens v2 retired. Their continued absence is part of the contract. */
const RETIRED_TOKENS = [
  '--p3',
  '--p4',
  '--p5',
  '--p3-bg',
  '--p4-bg',
  '--p5-bg',
  '--paper',
] as const;

/** Every surface a piece of text or a control border is allowed to sit on. */
const SURFACES = ['--ground', '--surface', '--surface-2', '--surface-3'] as const;

/** [foreground, background, minimum ratio, why] */
const PAIRS: Array<[string, string, number, string]> = [
  // --- reading text -------------------------------------------------------
  ['--ink', '--ground', 7, 'body text on the page (AAA, because problem statements are long)'],
  ['--ink', '--surface', 7, 'body text on a card'],
  ['--ink', '--surface-2', 7, 'body text in an inset well'],
  ['--ink', '--surface-3', 7, 'body text on the deepest well'],
  ['--ink-2', '--ground', 4.5, 'secondary text'],
  ['--ink-2', '--surface', 4.5, 'secondary text on a card'],
  ['--ink-2', '--surface-2', 4.5, 'secondary text in a well'],
  ['--ink-2', '--surface-3', 4.5, 'secondary text on the deepest well'],

  // --- metadata. docs/05 §9 names --ink-3 on --surface-2 specifically. -----
  ['--ink-3', '--ground', 4.5, 'metadata and ids'],
  ['--ink-3', '--surface', 4.5, 'metadata on a card'],
  ['--ink-3', '--surface-2', 4.5, 'metadata inside an inset well — the pair §9 calls out'],
  ['--ink-3', '--surface-3', 4.5, 'metadata on the sidebar rail'],

  // --- accent -------------------------------------------------------------
  ['--accent-700', '--ground', 4.5, 'links'],
  ['--accent-700', '--surface', 4.5, 'links on a card'],
  ['--accent-700', '--surface-2', 4.5, 'links in a well'],
  ['--accent-700', '--accent-100', 4.5, 'accent text on an accent-tinted fill'],
  ['--accent-600', '--ground', 3, 'accent as a control border'],
  ['--accent-600', '--surface', 3, 'accent border on a card'],

  // --- focus and control boundaries (WCAG 1.4.11, 3:1) --------------------
  ['--focus', '--ground', 3, 'focus ring against the page'],
  ['--focus', '--surface', 3, 'focus ring against a card'],
  ['--focus', '--surface-2', 3, 'focus ring inside a well'],
  ['--rule-strong', '--ground', 3, 'answer-choice and input borders on the page'],
  [
    '--rule-strong',
    '--surface',
    3,
    'the same border on a card — --surface on --ground is 1.06:1,' +
      ' so this border is the only thing identifying the control',
  ],
  ['--rule-strong', '--surface-2', 3, 'control borders in a well'],

  // --- RESERVED feedback: every 700 on its own 100 (docs/05 §10.3) --------
  ['--correct-700', '--correct-100', 4.5, '"Correct" text on the correct panel'],
  ['--correct-700', '--surface', 4.5, 'the word "correct" beside an answer choice'],
  ['--correct-border', '--correct-100', 3, 'the correct panel edge'],
  ['--correct-600', '--surface', 3, 'a solid correct mark on a card'],
  ['--wrong-700', '--wrong-100', 4.5, '"Not B." text on the incorrect panel'],
  ['--wrong-700', '--surface', 4.5, 'the words "your answer" beside a choice'],
  ['--wrong-border', '--wrong-100', 3, 'the incorrect panel edge'],
  ['--wrong-600', '--surface', 3, 'a solid incorrect mark on a card'],
  ['--hint-700', '--hint-100', 4.5, 'hint text on an opened hint'],
  ['--hint-700', '--surface', 4.5, 'the "Show a hint" control'],
  ['--hint-border', '--hint-100', 3, 'the opened-hint edge'],

  // --- difficulty ramp: each fg on its own bg (docs/05 §10.3) -------------
  ['--d1-fg', '--d1-bg', 4.5, '3-point difficulty pill'],
  ['--d2-fg', '--d2-bg', 4.5, '4-point difficulty pill'],
  ['--d3-fg', '--d3-bg', 4.5, '5-point difficulty pill'],
];

describe('tokens.css', () => {
  it('defines every color token in the light palette on bare :root', () => {
    for (const token of COLOR_TOKENS) {
      expect(light[token], `${token} missing from :root`).toBeDefined();
      expect(parseHex(light[token] ?? ''), `${token} is not a hex color`).not.toBeNull();
    }
  });

  it('has retired --p3/--p4/--p5 and --paper entirely', () => {
    for (const token of RETIRED_TOKENS) {
      expect(light[token], `${token} still exists`).toBeUndefined();
      expect(darkExplicit[token], `${token} still exists in dark`).toBeUndefined();
    }
  });

  it('no longer aliases a feedback colour to a difficulty colour', () => {
    // The v1 bug: --correct was literally var(--p3) and --incorrect was var(--p5), so the
    // colour that told a student they were wrong also meant "5 points". docs/05 §10.1.
    for (const [token, value] of Object.entries(light)) {
      if (!/^--(correct|wrong|hint)-/.test(token)) continue;
      expect(value, `${token} must be a literal colour, not an alias`).not.toMatch(/var\(/);
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

  /**
   * The mastery ramp is tested differently from the pairs above, on purpose.
   *
   * A mastery indicator is never colour alone (docs/05 §7.5): every one carries its name and
   * its glyph, and every dot is drawn with a --rule-strong outline, which is where its 3:1
   * boundary comes from — that pair is asserted above. So the question for --m0..--m3 is not
   * "does each step contrast with the surface", which no four-step ramp between two light
   * values can satisfy. It is "is this a ramp at all once the colour is gone", because the
   * segmented mastery bar has no room for a glyph inside a segment and photocopies flat.
   *
   * docs/05 §4's original values failed exactly that: --m0 and --m1 were 1.01:1 apart.
   */
  describe.each([
    ['light', light],
    ['dark', { ...light, ...darkExplicit }],
  ])('%s mastery ramp survives greyscale', (_theme, palette) => {
    const ramp = ['--m0', '--m1', '--m2', '--m3'].map((token) => palette[token] ?? '');

    it('is monotonic in luminance, so it reads as a ramp with no colour at all', () => {
      const luminance = ramp.map((hex) => relativeLuminance(parseHex(hex) ?? { r: 0, g: 0, b: 0 }));
      const rising = luminance.every((value, i) => i === 0 || value > (luminance[i - 1] ?? 0));
      const falling = luminance.every((value, i) => i === 0 || value < (luminance[i - 1] ?? 0));
      expect(
        rising || falling,
        `not monotonic: ${luminance.map((v) => v.toFixed(3)).join(' ')}`,
      ).toBe(true);
    });

    it.each([0, 1, 2])('step %i is distinguishable from the next', (index) => {
      const from = ramp[index] ?? '';
      const to = ramp[index + 1] ?? '';
      expect(Number(contrastRatio(from, to).toFixed(2))).toBeGreaterThanOrEqual(1.35);
    });

    it('ends on a step that can also carry text or an icon on any surface', () => {
      for (const surface of SURFACES) {
        expect(contrastRatio(palette['--m3'] ?? '', palette[surface] ?? '')).toBeGreaterThanOrEqual(
          3,
        );
      }
    });
  });

  /**
   * Print. docs/05 §9 says to test a printed worksheet, and tokens.css flattens the palette
   * under @media print. Difficulty goes to white because the ●○○ glyph carries the tier on
   * paper; mastery keeps a four-step grey ramp because the bar's segments have no glyph.
   */
  describe('the print palette', () => {
    const print = extractTokenBlock(
      css,
      ":root,\n  :root[data-theme='dark'],\n  :root:not([data-theme='light'])",
    );

    it('flattens ink and surfaces to black on white', () => {
      expect(print['--ink']).toBe('#000000');
      expect(print['--ground']).toBe('#ffffff');
      expect(print['--surface-3']).toBe('#ffffff');
    });

    it('keeps the mastery ramp separable in grey', () => {
      const ramp = ['--m0', '--m1', '--m2', '--m3'].map((token) => print[token] ?? '');
      expect(ramp.every(Boolean)).toBe(true);
      for (let index = 0; index < ramp.length - 1; index += 1) {
        expect(
          Number(contrastRatio(ramp[index] ?? '', ramp[index + 1] ?? '').toFixed(2)),
        ).toBeGreaterThanOrEqual(1.35);
      }
    });

    it('drops the reserved hues entirely — a photocopy has no green or red', () => {
      for (const token of ['--correct-700', '--wrong-700', '--hint-700']) {
        expect(print[token]).toBe('#000000');
      }
    });
  });
});
