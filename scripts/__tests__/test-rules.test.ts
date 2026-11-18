import { describe, it, expect, afterEach } from 'vitest';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateTestContent, type TestRuleId } from '../lib/test-rules.ts';

/**
 * Each SAT / ACT rule gets a failing case and the committed content must stay clean. Cases copy
 * the real content/tests/ into a temp dir and break one thing, using the fixed sample problems
 * SA-0997 and AC-0997 so the cases never depend on what authors add later.
 */

const REAL = join(process.cwd(), 'content');
const dirs: string[] = [];

function scratch(): { contentDir: string; figuresDir: string; sat: string; act: string } {
  const root = mkdtempSync(join(tmpdir(), 'test-rules-'));
  dirs.push(root);
  const contentDir = join(root, 'content');
  cpSync(join(REAL, 'tests'), join(contentDir, 'tests'), { recursive: true });
  const figuresDir = join(root, 'figures');
  mkdirSync(figuresDir);
  writeFileSync(join(figuresDir, 'RealFigure.tsx'), 'export {};\n');
  return {
    contentDir,
    figuresDir,
    sat: join(contentDir, 'tests', 'sat'),
    act: join(contentDir, 'tests', 'act'),
  };
}

type Json = Record<string, unknown>;
const readJson = (file: string): Json => JSON.parse(readFileSync(file, 'utf8')) as Json;
const writeJson = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value));

function edit(file: string, change: (value: Json) => void): void {
  const value = readJson(file);
  change(value);
  writeJson(file, value);
}

function rulesFired(dir: { contentDir: string; figuresDir: string }): TestRuleId[] {
  return validateTestContent(dir).findings.map((f) => f.rule);
}

const satSample = (d: { sat: string }) => join(d.sat, 'problems', 'SA-0997.json');
const actSample = (d: { act: string }) => join(d.act, 'problems', 'AC-0997.json');

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('SAT / ACT content rules', () => {
  it('the committed content/tests/ is clean', () => {
    const result = validateTestContent({
      contentDir: REAL,
      figuresDir: join(process.cwd(), 'src', 'components', 'figures'),
    });
    expect(result.findings.map((f) => `${f.rule} @ ${f.file}: ${f.message}`)).toEqual([]);
    expect(result.counts.SAT).toBeGreaterThanOrEqual(2);
    expect(result.counts.ACT).toBeGreaterThanOrEqual(2);
    expect(result.taxonomies.SAT?.domains.map((d) => d.id)).toEqual(['ALG', 'ADV', 'PSD', 'GEO']);
    expect(result.taxonomies.ACT?.domains.map((d) => d.id)).toEqual([
      'NQ',
      'ALG',
      'FUN',
      'GEO',
      'STAT',
    ]);
  });

  it('every committed domain has 5-9 skills', () => {
    const { taxonomies } = validateTestContent({ contentDir: REAL });
    for (const taxonomy of [taxonomies.SAT, taxonomies.ACT]) {
      for (const domain of taxonomy?.domains ?? []) {
        expect(domain.skills.length).toBeGreaterThanOrEqual(5);
        expect(domain.skills.length).toBeLessThanOrEqual(9);
      }
    }
  });

  it('is silent when there is no content/tests/ at all', () => {
    const root = mkdtempSync(join(tmpdir(), 'tests-none-'));
    dirs.push(root);
    expect(validateTestContent({ contentDir: root }).findings).toEqual([]);
  });

  it('requires a misconception on every wrong choice', () => {
    const d = scratch();
    edit(satSample(d), (p) => {
      const choices = p.choices as Json[];
      (choices[1] as Json).misconception = null;
    });
    expect(rulesFired(d)).toContain('tests/misconception-required');
  });

  it('forbids a misconception on the correct choice', () => {
    const d = scratch();
    edit(satSample(d), (p) => {
      const choices = p.choices as Json[];
      const right = choices.find((c) => c.correct === true) as Json;
      right.misconception = 'I think this is the right answer for a reason I can explain.';
    });
    expect(rulesFired(d)).toContain('tests/correct-choice-no-misconception');
  });

  it('requires exactly four choices', () => {
    const d = scratch();
    edit(actSample(d), (p) => {
      (p.choices as Json[]).push({
        key: 'E',
        text: '$1$',
        correct: false,
        misconception: 'I picked a fifth choice that the real test would never offer.',
      });
    });
    expect(rulesFired(d)).toContain('tests/schema-problem');
  });

  it('requires choice keys A-D in order and exactly one correct', () => {
    const d = scratch();
    edit(actSample(d), (p) => {
      const choices = p.choices as Json[];
      (choices[0] as Json).key = 'E';
      for (const c of choices) c.correct = false;
      for (const c of choices) {
        c.misconception ??= 'I picked this because every choice is now marked wrong here.';
      }
    });
    const fired = rulesFired(d);
    expect(fired).toContain('tests/problem-choice-keys');
    expect(fired).toContain('tests/problem-exactly-one-correct');
  });

  it('requires alt text and an existing component for a figure', () => {
    const d = scratch();
    edit(satSample(d), (p) => {
      p.figure = { component: 'MissingFigure', alt: 'short' };
    });
    expect(rulesFired(d)).toContain('tests/figure-alt-required');
    edit(satSample(d), (p) => {
      p.figure = { component: 'MissingFigure', alt: 'A long enough description of the figure.' };
    });
    expect(rulesFired(d)).toContain('tests/figure-component-exists');
    edit(satSample(d), (p) => {
      p.figure = { component: 'RealFigure', alt: 'A long enough description of the figure.' };
    });
    expect(rulesFired(d)).toEqual([]);
  });

  it('requires the file name to match the id', () => {
    const d = scratch();
    renameSync(satSample(d), join(d.sat, 'problems', 'SA-0123.json'));
    expect(rulesFired(d)).toContain('tests/problem-id-matches-path');
  });

  it('requires the folder to match the test', () => {
    const d = scratch();
    renameSync(satSample(d), join(d.act, 'problems', 'SA-0997.json'));
    expect(rulesFired(d)).toContain('tests/problem-id-matches-path');
  });

  it('rejects an id whose prefix disagrees with the test field', () => {
    const d = scratch();
    edit(satSample(d), (p) => {
      p.test = 'ACT';
    });
    expect(rulesFired(d)).toContain('tests/problem-id-matches-path');
  });

  it('rejects a duplicate id', () => {
    const d = scratch();
    mkdirSync(join(d.sat, 'problems', 'extra'));
    cpSync(satSample(d), join(d.sat, 'problems', 'extra', 'SA-0997.json'));
    expect(rulesFired(d)).toContain('tests/problem-duplicate-id');
  });

  it('requires the skill to exist in the same test and sit in the stated domain', () => {
    const d = scratch();
    edit(satSample(d), (p) => {
      p.skill = 'ALG-42';
    });
    expect(rulesFired(d)).toContain('tests/skill-exists');
    edit(satSample(d), (p) => {
      p.skill = 'ADV-01';
    });
    expect(rulesFired(d)).toContain('tests/skill-domain-matches');
    // STAT-01 exists on the ACT but never on the SAT: skills are namespaced per test.
    edit(satSample(d), (p) => {
      p.domain = 'STAT';
      p.skill = 'STAT-01';
    });
    const fired = rulesFired(d);
    expect(fired).toContain('tests/domain-in-test');
    expect(fired).toContain('tests/skill-exists');
  });

  it('checks the taxonomy: test, domain set, unique skill ids, id prefixes', () => {
    const d = scratch();
    const file = join(d.sat, 'taxonomy.json');
    edit(file, (t) => {
      t.test = 'ACT';
    });
    expect(rulesFired(d)).toContain('tests/taxonomy-test-matches');
    edit(file, (t) => {
      t.test = 'SAT';
      const domains = t.domains as Json[];
      domains.pop();
      const first = domains[0] as Json;
      const skills = first.skills as Json[];
      skills.push({ ...(skills[0] as Json) });
      skills.push({ ...(skills[0] as Json), id: 'ADV-77' });
    });
    const fired = rulesFired(d);
    expect(fired).toContain('tests/taxonomy-domains');
    expect(fired).toContain('tests/taxonomy-duplicate-id');
    expect(fired).toContain('tests/skill-domain-prefix');
  });

  it('reports a missing taxonomy and bad JSON', () => {
    const d = scratch();
    rmSync(join(d.act, 'taxonomy.json'));
    writeFileSync(satSample(d), '{ not json');
    const fired = rulesFired(d);
    expect(fired).toContain('tests/taxonomy-missing');
    expect(fired).toContain('tests/json-parse');
  });
});
