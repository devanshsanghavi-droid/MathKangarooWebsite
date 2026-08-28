import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  validateContent,
  findCycle,
  deriveUnlocks,
  PAPER_FILE_MAX_BYTES,
  type RuleId,
} from '../lib/content-rules.ts';

const FIXTURES = join(process.cwd(), 'scripts', '__fixtures__');

function run(fixture: string, variant: 'pass' | 'fail') {
  const dir = join(FIXTURES, fixture, variant);
  const figuresDir = join(dir, 'figures');
  return validateContent({
    contentDir: join(dir, 'content'),
    ...(existsSync(figuresDir) ? { figuresDir } : {}),
  });
}

/**
 * The five content guardrails from docs/02-BUILD-PLAN.md M0.3.
 *
 * Each one gets a fixture that must fail and a fixture that must pass. A guardrail with only
 * a failing fixture proves it can fire; a guardrail with only a passing fixture proves it can
 * stay quiet. You need both, or you cannot tell a working rule from a rule that is always on
 * or always off.
 */
const GUARDRAILS: Array<{ fixture: string; rules: RuleId[]; what: string }> = [
  {
    fixture: 'misconception-required',
    rules: ['problem/misconception-required'],
    what: 'an incorrect choice with no written misconception',
  },
  {
    fixture: 'figure-alt-required',
    rules: ['problem/figure-alt-required'],
    what: 'a problem with a figure and no author-written alt text',
  },
  {
    fixture: 'paper-size-cap',
    rules: ['paper/size-cap'],
    what: 'a file in content/papers/ over the anti-paste byte cap',
  },
  {
    fixture: 'duplicate-ids',
    rules: ['problem/duplicate-id', 'skill/duplicate-id'],
    what: 'a duplicated problem id and a duplicated skill id',
  },
  {
    fixture: 'skill-reference',
    rules: ['problem/skill-exists', 'paper/skill-exists'],
    what: 'a problem and a paper index pointing at a skill that is not in the Atlas',
  },
];

describe('content guardrails', () => {
  describe.each(GUARDRAILS)('$fixture — rejects $what', ({ fixture, rules }) => {
    it('fails on the failing fixture, naming the right rule', () => {
      const { findings } = run(fixture, 'fail');
      const fired = new Set(findings.map((f) => f.rule));
      for (const rule of rules) {
        expect([...fired], `expected ${rule} to fire`).toContain(rule);
      }
    });

    it('says nothing at all about the passing fixture', () => {
      const { findings } = run(fixture, 'pass');
      expect(
        findings.map((f) => `${f.rule} @ ${f.file}: ${f.message}`),
        'the passing fixture must be completely clean',
      ).toEqual([]);
    });

    it('reports a message explaining why the rule exists, not just that it failed', () => {
      const { findings } = run(fixture, 'fail');
      for (const rule of rules) {
        const finding = findings.find((f) => f.rule === rule);
        expect(finding).toBeDefined();
        expect(finding?.message.length).toBeGreaterThan(40);
      }
    });
  });

  it('the oversize paper fixture really is over the cap', () => {
    const file = join(FIXTURES, 'paper-size-cap', 'fail', 'content', 'papers', '2019-3-4.json');
    expect(statSync(file).size).toBeGreaterThan(PAPER_FILE_MAX_BYTES);
  });

  it('the passing paper fixture really is under the cap', () => {
    const file = join(FIXTURES, 'paper-size-cap', 'pass', 'content', 'papers', '2019-3-4.json');
    expect(statSync(file).size).toBeLessThanOrEqual(PAPER_FILE_MAX_BYTES);
  });
});

describe('prerequisite graph', () => {
  it('reports no cycle for a DAG', () => {
    const graph = new Map([
      ['A', []],
      ['B', ['A']],
      ['C', ['A', 'B']],
      ['D', ['C']],
    ]);
    expect(findCycle(graph)).toBeNull();
  });

  it('finds a two-node cycle', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', ['A']],
    ]);
    const cycle = findCycle(graph);
    expect(cycle).not.toBeNull();
    expect(cycle?.at(0)).toBe(cycle?.at(-1));
  });

  it('finds a longer cycle buried in an otherwise acyclic graph', () => {
    const graph = new Map([
      ['A', []],
      ['B', ['A', 'E']],
      ['C', ['B']],
      ['D', ['C']],
      ['E', ['D']],
      ['F', ['A']],
    ]);
    const cycle = findCycle(graph);
    expect(cycle).not.toBeNull();
    expect(cycle?.length).toBeGreaterThan(3);
  });

  it('is deterministic — the same graph always reports the same cycle', () => {
    const build = () =>
      new Map([
        ['A', ['C']],
        ['B', ['A']],
        ['C', ['B']],
      ]);
    expect(findCycle(build())).toEqual(findCycle(build()));
  });

  it('ignores dangling edges rather than crashing on them', () => {
    const graph = new Map([['A', ['does-not-exist']]]);
    expect(findCycle(graph)).toBeNull();
  });

  it('derives unlocks as the exact reverse of prerequisites, sorted', () => {
    const graph = new Map([
      ['NUM-01', []],
      ['NUM-03', ['NUM-01']],
      ['NUM-04', ['NUM-01', 'NUM-03']],
    ]);
    expect(deriveUnlocks(graph)).toEqual(
      new Map([
        ['NUM-01', ['NUM-03', 'NUM-04']],
        ['NUM-03', ['NUM-04']],
        ['NUM-04', []],
      ]),
    );
  });
});

describe('the CLI that CI actually runs', () => {
  const cli = join(process.cwd(), 'scripts', 'validate-content.ts');

  it('exits 0 on a clean content tree', () => {
    const dir = join(FIXTURES, 'misconception-required', 'pass');
    const result = spawnSync(process.execPath, [cli], {
      encoding: 'utf8',
      env: { ...process.env, CONTENT_DIR: join(dir, 'content'), FIGURES_DIR: join(dir, 'figures') },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('content ok');
  });

  it('exits non-zero and names the rule on a broken content tree', () => {
    const dir = join(FIXTURES, 'misconception-required', 'fail');
    const result = spawnSync(process.execPath, [cli], {
      encoding: 'utf8',
      env: { ...process.env, CONTENT_DIR: join(dir, 'content'), FIGURES_DIR: join(dir, 'figures') },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('problem/misconception-required');
  });
});

describe('the paper tripwire covers every file, not only the JSON', () => {
  it('catches an oversized non-JSON file pasted into content/papers/', () => {
    const { findings } = run('paper-size-cap', 'fail');
    const flagged = findings.filter((f) => f.rule === 'paper/size-cap').map((f) => f.file);
    expect(flagged.some((file) => file.endsWith('.txt'))).toBe(true);
  });

  it('still passes a clean tree that happens to contain a small README', () => {
    const { findings } = run('paper-size-cap', 'pass');
    expect(findings).toEqual([]);
  });
});
