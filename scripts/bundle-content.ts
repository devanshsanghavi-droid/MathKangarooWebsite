import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * `pnpm bundle:content` — freeze content/ into a module the JavaScript bundler can see.
 *
 * ---------------------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `src/lib/content.ts` loads skills and problems with readdirSync/readFileSync from
 * `join(process.cwd(), 'content')`. That works in dev, in tests, and during `next build`,
 * where there is a filesystem and a sensible working directory.
 *
 * There is neither on Cloudflare Workers. On workerd `process.cwd()` is `/bundle`, and the
 * only things there are worker.js and a few wasm blobs — no content directory at any path.
 * Every prerendered page was fine, because its HTML was baked at build time. But the three
 * routes that render at request time because they read searchParams — /problems, /atlas and
 * /print — silently produced an EMPTY index and rendered a site with no problems and no
 * skills in it. They returned HTTP 200 the whole time, which is how a route check missed it.
 *
 * Bundling the content into a JSON module puts it in the graph the bundler traces, so it
 * ships inside the worker and needs no filesystem at all.
 *
 * The output is committed, and `--check` fails CI when it drifts from content/ — the same
 * arrangement scripts/derive-unlocks.ts already uses for the skill graph, for the same
 * reason: derived data that can silently disagree with its source is worse than no derived
 * data at all.
 * ---------------------------------------------------------------------------------------
 */

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'content');
const OUTPUT = join(ROOT, 'src', 'lib', 'content.bundle.json');

function listJson(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listJson(full, out);
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function collect(kind: 'skills' | 'problems' | 'papers'): unknown[] {
  return listJson(join(CONTENT, kind)).map((file) => JSON.parse(readFileSync(file, 'utf8')));
}

const bundle = {
  // Regenerate with `pnpm bundle:content`; CI runs `--check` to prove it matches content/.
  generatedBy: 'scripts/bundle-content.ts',
  skills: collect('skills'),
  problems: collect('problems'),
  papers: collect('papers'),
};

// Stable key order and two-space indent, so the committed diff is reviewable and the
// --check comparison is a plain string equality rather than a deep object walk.
const serialised = JSON.stringify(bundle, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {
    console.error(`${relative(ROOT, OUTPUT)} is missing. Run: pnpm bundle:content`);
    process.exit(1);
  }
  if (current !== serialised) {
    console.error(
      `${relative(ROOT, OUTPUT)} is out of date with content/.\n` +
        'Someone edited a skill or problem without regenerating the bundle, which means the\n' +
        'deployed worker would serve different content from the repository.\n' +
        'Run: pnpm bundle:content',
    );
    process.exit(1);
  }
  console.log(
    `content bundle in sync — ${bundle.skills.length} skills, ${bundle.problems.length} problems, ` +
      `${bundle.papers.length} paper indexes`,
  );
  process.exit(0);
}

writeFileSync(OUTPUT, serialised);
const bytes = statSync(OUTPUT).size;
console.log(
  `wrote ${relative(ROOT, OUTPUT)} — ${bundle.skills.length} skills, ` +
    `${bundle.problems.length} problems, ${bundle.papers.length} paper indexes, ` +
    `${Math.round(bytes / 1024)} KB`,
);
