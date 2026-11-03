import { checkPalette, FEEDBACK_FILES } from './lib/palette-rules.ts';

/**
 * `pnpm check:palette` - enforces the reserved-colour rule from
 * docs/05-DESIGN-DIRECTION.md §2, as §10.4 requires.
 *
 * v1's tokens.css contained `--correct: var(--p3)` and `--incorrect: var(--p5)`: the colour
 * that told a student they were wrong was literally the same variable that labelled a 5-point
 * question. Nobody noticed for a whole phase. This is the check that would have.
 */
const violations = checkPalette(process.cwd());

if (violations.length === 0) {
  console.log(
    `palette ok - green, red and amber confined to ${FEEDBACK_FILES.length} feedback files, ` +
      `no reserved hex outside tokens.css, no retired point tokens`,
  );
  process.exit(0);
}

for (const violation of violations) {
  console.error(`${violation.file}:${violation.line}  [${violation.rule}]  ${violation.detail}`);
}
console.error(`\n${violations.length} palette violation${violations.length === 1 ? '' : 's'}.`);
process.exit(1);
