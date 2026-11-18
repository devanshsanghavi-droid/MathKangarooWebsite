#!/usr/bin/env node
/**
 * `pnpm validate:content`
 *
 * Runs every content rule against content/ and exits non-zero on the first failure set.
 * CI gates on this. The rules themselves live in scripts/lib/content-rules.ts so they can
 * be unit tested against fixtures.
 */

import { join } from 'node:path';
import { validateContent } from './lib/content-rules.ts';
import { validateAmcContent } from './lib/amc-rules.ts';
import { validateTestContent } from './lib/test-rules.ts';

/** A finding from either rule set. Rule ids are namespaced, so they never collide. */
interface Finding {
  rule: string;
  file: string;
  message: string;
}

const root = process.cwd();

// CONTENT_DIR / FIGURES_DIR exist so the CLI itself can be exercised against
// scripts/__fixtures__/ in a test. Nothing in CI sets them.
const contentDir = process.env.CONTENT_DIR ?? join(root, 'content');
const figuresDir = process.env.FIGURES_DIR ?? join(root, 'src', 'components', 'figures');

const result = validateContent({ contentDir, figuresDir });
// The AMC beta (content/amc/) is validated by its own rule set; see scripts/lib/amc-rules.ts.
const amc = validateAmcContent({ contentDir, figuresDir });
// SAT / ACT (content/tests/) have their own rule set too; see scripts/lib/test-rules.ts.
const tests = validateTestContent({ contentDir, figuresDir });

const { counts } = result;
const findings: Finding[] = [...result.findings, ...amc.findings, ...tests.findings];
const summary =
  `${counts.skills} skills, ${counts.problems} problems, ${counts.papers} paper indexes, ` +
  `${amc.counts.problems} AMC problems, ${amc.counts.formulas} AMC formulas, ` +
  `${tests.counts.SAT} SAT problems, ${tests.counts.ACT} ACT problems`;

function groupByRule(items: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  for (const item of items) {
    const bucket = map.get(item.rule);
    if (bucket) bucket.push(item);
    else map.set(item.rule, [item]);
  }
  return map;
}

if (findings.length === 0) {
  console.log(`content ok - ${summary}`);
  process.exit(0);
}

console.error(
  `content validation failed - ${findings.length} problem${findings.length === 1 ? '' : 's'} ` +
    `across ${summary}\n`,
);

for (const [rule, items] of [...groupByRule(findings)].sort(([a], [b]) => a.localeCompare(b))) {
  console.error(`  ${rule}  (${items.length})`);
  for (const item of items) {
    console.error(`    ${item.file}`);
    console.error(`      ${item.message}`);
  }
  console.error('');
}

process.exit(1);
