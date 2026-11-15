#!/usr/bin/env node
/**
 * `node scripts/build-static-data.ts` - runs in `prebuild`, AFTER `validate-content`.
 *
 * Writes the gitignored `public/data/` (docs/06 §3): the Kangaroo and AMC bank indexes, the
 * lookup tables the filters need, and one file per problem for practice sessions. See
 * src/lib/bank-data.ts for every format. Static files are free on the Workers plan; a worker
 * rendering a filtered page per click is not.
 *
 * CONTENT_DIR / STATIC_DATA_DIR override the paths, for tests. Nothing in CI sets them.
 */

import { join, relative } from 'node:path';
import { writeStaticData } from './lib/static-data.ts';

const root = process.cwd();
const contentDir = process.env.CONTENT_DIR ?? join(root, 'content');
const outDir = process.env.STATIC_DATA_DIR ?? join(root, 'public', 'data');

try {
  const result = writeStaticData({ contentDir, outDir });
  const amc = result.amc ? `, ${result.amc.problems} AMC problems` : ', no AMC content';
  console.log(
    `wrote ${relative(root, outDir) || outDir} - ${result.ka.problems} Kangaroo problems, ` +
      `${result.ka.skills} skills${amc}, ${result.files} files`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
