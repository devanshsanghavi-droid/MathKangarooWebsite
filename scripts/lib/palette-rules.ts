import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The reserved-colour rule, enforced - docs/05-DESIGN-DIRECTION.md §2 and §10.4.
 *
 *   Green, red and amber appear only in response to something the student did: correct,
 *   incorrect, hint taken. Never for difficulty, never for a category, never for decoration.
 *
 * Two checks, because the rule can be broken two ways.
 *
 *   reserved-token-leak   a --correct* / --wrong* / --hint* token, or the Tailwind utility
 *                         built from it, used in a file that is not a feedback surface.
 *   reserved-hex          a green, red or amber hex literal anywhere under src/ except
 *                         tokens.css, which is the only file allowed to define a colour.
 *
 * §10.4 names green and red. Amber is checked too, because §2 reserves three colours and a
 * rule that lets one of them through is not the rule.
 */

export interface PaletteViolation {
  rule: 'reserved-token-leak' | 'reserved-hex' | 'retired-token';
  file: string;
  line: number;
  detail: string;
}

/**
 * Files that may use the reserved feedback colours, each with the reason it qualifies.
 * Adding a file here is a design decision, not a formality: it is a claim that the colour in
 * that file means "you did something and this is how it went", and nothing else.
 */
export const FEEDBACK_FILES: ReadonlyArray<{ path: string; because: string }> = [
  { path: 'src/styles/tokens.css', because: 'defines them' },
  { path: 'src/styles/globals.css', because: 'bridges them into the Tailwind namespace' },
  {
    path: 'src/components/FeedbackPanel.tsx',
    because: 'the distractor-specific feedback panel - the reason the site exists',
  },
  {
    path: 'src/components/ChoiceList.tsx',
    because: 'an answer choice shown as correct or as the wrong one the student picked',
  },
  { path: 'src/components/HintLadder.tsx', because: 'a hint that has been taken (the amber)' },
  {
    path: 'src/components/practice/LadderRunner.tsx',
    because: 'the sticky "Show a hint" control, which is the hint affordance itself',
  },
  {
    path: 'src/components/practice/MockReport.tsx',
    because: 'per-question correct/incorrect on the post-exam scatter',
  },
  {
    path: 'src/app/author/new/AuthorForm.tsx',
    because:
      'marks which choice the author flagged correct, and marks a problem CI would reject - ' +
      'the same "you did this and here is how it went" meaning',
  },
  {
    path: 'src/app/contact/ContactForm.tsx',
    because: 'form validation: the message sent, or a field that was filled in wrong',
  },
];

const ALLOWED = new Set(FEEDBACK_FILES.map((entry) => entry.path));

/** `--correct-700`, and the Tailwind utilities built from the same tokens. */
const RESERVED_TOKEN = /--(?:correct|wrong|hint)-[a-z0-9-]+/g;
const RESERVED_UTILITY =
  /\b(?:bg|text|border|fill|stroke|ring|outline|decoration|from|via|to|accent|shadow)-(?:correct|wrong|hint)-[a-z0-9]+\b/g;

/** The tokens v2 retired. They must not exist anywhere, in any form. */
const RETIRED_TOKEN = /--p[345]\b|\b(?:bg|text|border|fill|stroke)-p[345](?:-bg)?\b/g;

const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): Hsl | null {
  const raw = hex.replace(/^#/, '');
  const full =
    raw.length === 3 || raw.length === 4
      ? raw
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

/**
 * Is this hex one of the three reserved hues, saturated and mid-toned enough to actually read
 * as green / red / amber? Near-greys and near-blacks are not - `#fff` and `#000` in a print
 * block are not a rule violation.
 */
export function reservedHue(hex: string): 'red' | 'green' | 'amber' | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  if (hsl.s < 0.15 || hsl.l < 0.08 || hsl.l > 0.93) return null;
  const h = ((hsl.h % 360) + 360) % 360;
  if (h < 18 || h >= 345) return 'red';
  if (h >= 20 && h < 55) return 'amber';
  if (h >= 80 && h <= 170) return 'green';
  return null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx?|css|jsx?|mjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank out comments while keeping every newline, so reported line numbers stay true.
 *
 * Needed because the files that explain this rule quote the very tokens it bans - the header
 * of tokens.css names `--p3` in the sentence describing why `--p3` no longer exists. A checker
 * that cannot tell prose from code makes documenting the rule impossible.
 */
export function stripCommentsPreservingLines(source: string): string {
  let out = '';
  let index = 0;
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    if (two === '/*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(index, stop).replace(/[^\n]/g, ' ');
      index = stop;
      continue;
    }
    // A line comment, but not the `//` inside `https://`.
    if (two === '//' && source[index - 1] !== ':') {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      out += ' '.repeat(stop - index);
      index = stop;
      continue;
    }
    out += source[index];
    index += 1;
  }
  return out;
}

function findings(file: string, source: string, relPath: string): PaletteViolation[] {
  const out: PaletteViolation[] = [];
  const lines = stripCommentsPreservingLines(source).split('\n');
  const allowed = ALLOWED.has(relPath);
  const isTokens = relPath === 'src/styles/tokens.css';

  lines.forEach((text, index) => {
    const line = index + 1;

    for (const match of [...text.matchAll(RETIRED_TOKEN)]) {
      out.push({
        rule: 'retired-token',
        file: relPath,
        line,
        detail:
          `\`${match[0]}\` was retired in v2. The 3/4/5-point tiers use the neutral --d1/--d2/--d3 ` +
          `ramp; see docs/05-DESIGN-DIRECTION.md §3.`,
      });
    }

    if (!allowed) {
      for (const match of [...text.matchAll(RESERVED_TOKEN), ...text.matchAll(RESERVED_UTILITY)]) {
        out.push({
          rule: 'reserved-token-leak',
          file: relPath,
          line,
          detail:
            `\`${match[0]}\` is a RESERVED feedback colour. It may only appear in response to ` +
            `something the student did - correct, incorrect, hint taken. Use a neutral or the ` +
            `teal accent, or add this file to FEEDBACK_FILES with a reason it qualifies.`,
        });
      }
    }

    if (!isTokens) {
      for (const match of [...text.matchAll(HEX)]) {
        const hue = reservedHue(match[0]);
        if (!hue) continue;
        out.push({
          rule: 'reserved-hex',
          file: relPath,
          line,
          detail:
            `\`${match[0]}\` is ${hue}. Colours are defined only in src/styles/tokens.css, and ` +
            `green, red and amber are reserved for feedback (docs/05 §2).`,
        });
      }
    }
  });

  return out;
}

export function checkPalette(root: string): PaletteViolation[] {
  const srcDir = join(root, 'src');
  return walk(srcDir)
    .filter((file) => !/__tests__/.test(file))
    .flatMap((file) =>
      findings(file, readFileSync(file, 'utf8'), relative(root, file).split(sep).join('/')),
    )
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
