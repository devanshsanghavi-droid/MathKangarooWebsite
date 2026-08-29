import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  checkPalette,
  FEEDBACK_FILES,
  hexToHsl,
  reservedHue,
  stripCommentsPreservingLines,
} from '../lib/palette-rules.ts';

const fixture = (name: string) => join(process.cwd(), 'scripts/__fixtures__/palette', name);

describe('the reserved-colour rule', () => {
  it('passes a fixture that keeps green, red and amber inside tokens.css', () => {
    expect(checkPalette(fixture('pass'))).toEqual([]);
  });

  it('catches a difficulty pill wearing a feedback colour', () => {
    const violations = checkPalette(fixture('fail'));
    const leaks = violations.filter((v) => v.rule === 'reserved-token-leak');
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks[0]?.file).toBe('src/components/DifficultyPill.tsx');
    expect(leaks.map((v) => v.detail).join(' ')).toMatch(/RESERVED/);
  });

  it('catches a green hex literal outside tokens.css', () => {
    const hexes = checkPalette(fixture('fail')).filter((v) => v.rule === 'reserved-hex');
    expect(hexes.length).toBe(1);
    expect(hexes[0]?.detail).toMatch(/`#1a8a55` is green/);
  });

  it('catches the retired point tokens anywhere at all', () => {
    const retired = checkPalette(fixture('fail')).filter((v) => v.rule === 'retired-token');
    expect(retired.length).toBeGreaterThan(0);
    expect(retired.some((v) => v.file === 'src/components/Legacy.tsx')).toBe(true);
  });

  it('reports true line numbers even when comments were stripped', () => {
    const leak = checkPalette(fixture('fail')).find((v) => v.rule === 'reserved-token-leak');
    // The className is on line 4 of the fixture; the comment above it is line 2.
    expect(leak?.line).toBe(4);
  });

  it('leaves the real repo clean', () => {
    expect(checkPalette(process.cwd())).toEqual([]);
  });

  it('gives a reason for every file allowed to use a reserved colour', () => {
    for (const entry of FEEDBACK_FILES) {
      expect(entry.because.length, `${entry.path} has no reason`).toBeGreaterThan(10);
    }
  });
});

describe('hue classification', () => {
  it.each([
    ['#1a8a55', 'green'],
    ['#146c43', 'green'],
    ['#c4342a', 'red'],
    ['#a82820', 'red'],
    ['#875200', 'amber'],
    ['#e3bc6e', 'amber'],
  ])('%s is %s', (hex, expected) => {
    expect(reservedHue(hex)).toBe(expected);
  });

  it.each(['#ffffff', '#000000', '#f6f8fa', '#0e7c86', '#4b5563', '#c6cfdd'])(
    '%s is not a reserved hue',
    (hex) => {
      expect(reservedHue(hex)).toBeNull();
    },
  );

  it('treats near-grey as no hue at all, so a print block is not a violation', () => {
    expect(reservedHue('#fefefe')).toBeNull();
    expect(hexToHsl('#808080')?.s).toBe(0);
  });
});

describe('comment stripping', () => {
  it('keeps one line per line', () => {
    const source = 'a\n/* two\nthree */\nfour';
    expect(stripCommentsPreservingLines(source).split('\n')).toHaveLength(4);
  });

  it('does not mistake a URL for a line comment', () => {
    expect(stripCommentsPreservingLines("const u = 'https://x.test';")).toContain('https://x.test');
  });

  it('blanks a line comment', () => {
    expect(stripCommentsPreservingLines('const a = 1; // bg-correct-100').trim()).toBe(
      'const a = 1;',
    );
  });
});
