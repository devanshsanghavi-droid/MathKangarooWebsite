#!/usr/bin/env node
/**
 * `pnpm derive:unlocks`
 *
 * `unlocks` is the reverse of `prerequisites`. It is generated, never hand-written — a
 * hand-written reverse edge is how a graph silently stops agreeing with itself.
 *
 * This script:
 *   1. reads every skill file,
 *   2. fails loudly if any prerequisite id does not resolve,
 *   3. fails loudly if the prerequisite graph has a cycle (the Atlas must be a DAG),
 *   4. rewrites each file's `unlocks` array in place, sorted, only when it changed.
 *
 * `--check` reports what would change and exits non-zero instead of writing, so CI can
 * assert the committed files are already in sync.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SkillSchema } from '../src/lib/schemas.ts';
import { findCycle, deriveUnlocks } from './lib/content-rules.ts';

const checkOnly = process.argv.includes('--check');
const root = process.cwd();
const skillsDir = join(root, 'content', 'skills');

if (!existsSync(skillsDir)) {
  console.error(`no skills directory at ${relative(root, skillsDir)}`);
  process.exit(1);
}

interface Loaded {
  file: string;
  id: string;
  prerequisites: string[];
  unlocks: string[];
  raw: Record<string, unknown>;
}

const loaded: Loaded[] = [];

for (const strand of readdirSync(skillsDir, { withFileTypes: true }).sort((a, b) =>
  a.name.localeCompare(b.name),
)) {
  if (!strand.isDirectory()) continue;
  const dir = join(skillsDir, strand.name);
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith('.json')) continue;
    const file = join(dir, entry);
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const parsed = SkillSchema.omit({ unlocks: true })
      .extend({ unlocks: SkillSchema.shape.unlocks.optional() })
      .safeParse(raw);
    if (!parsed.success) {
      console.error(`${relative(root, file)} does not match the Skill schema:`);
      for (const issue of parsed.error.issues) {
        console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      process.exit(1);
    }
    loaded.push({
      file,
      id: parsed.data.id,
      prerequisites: parsed.data.prerequisites,
      unlocks: parsed.data.unlocks ?? [],
      raw: raw as Record<string, unknown>,
    });
  }
}

if (loaded.length === 0) {
  console.error('no skill files found');
  process.exit(1);
}

const known = new Set(loaded.map((s) => s.id));
let dangling = 0;
for (const skill of loaded) {
  for (const prereq of skill.prerequisites) {
    if (!known.has(prereq)) {
      console.error(`${skill.id} lists prerequisite ${prereq}, which does not exist`);
      dangling += 1;
    }
    if (prereq === skill.id) {
      console.error(`${skill.id} lists itself as a prerequisite`);
      dangling += 1;
    }
  }
}
if (dangling > 0) {
  console.error(`\n${dangling} dangling prerequisite reference(s). Nothing written.`);
  process.exit(1);
}

const prerequisites = new Map(loaded.map((s) => [s.id, s.prerequisites]));

const cycle = findCycle(prerequisites);
if (cycle) {
  console.error(`prerequisite graph is not acyclic: ${cycle.join(' -> ')}`);
  console.error('Nothing written. Break the cycle before re-running.');
  process.exit(1);
}

const derived = deriveUnlocks(prerequisites);
const changed: string[] = [];

for (const skill of loaded) {
  const expected = derived.get(skill.id) ?? [];
  const current = [...skill.unlocks].sort();
  if (expected.join(',') === current.join(',')) continue;
  changed.push(skill.id);
  if (checkOnly) {
    console.error(
      `${skill.id}: unlocks is [${current.join(', ')}] but should be [${expected.join(', ')}]`,
    );
    continue;
  }
  skill.raw.unlocks = expected;
  writeFileSync(skill.file, `${JSON.stringify(skill.raw, null, 2)}\n`, 'utf8');
}

const nodeCount = loaded.length;
const edgeCount = [...prerequisites.values()].reduce((n, list) => n + list.length, 0);

if (checkOnly) {
  if (changed.length > 0) {
    console.error(
      `\n${changed.length} skill file(s) have stale unlocks. Run \`pnpm derive:unlocks\`.`,
    );
    process.exit(1);
  }
  console.log(`unlocks in sync — ${nodeCount} skills, ${edgeCount} prerequisite edges, acyclic`);
  process.exit(0);
}

console.log(
  `derived unlocks for ${nodeCount} skills over ${edgeCount} prerequisite edges — graph is acyclic`,
);
console.log(
  changed.length === 0
    ? 'no files changed'
    : `rewrote ${changed.length} file(s): ${changed.join(', ')}`,
);
