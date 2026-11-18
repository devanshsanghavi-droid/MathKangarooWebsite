import { describe, it, expect, afterEach } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateAmcContent, type AmcRuleId } from '../lib/amc-rules.ts';

/**
 * Each AMC rule gets a failing case and the committed content must stay clean. Cases are built
 * by copying the real content/amc/ into a temp dir and breaking one thing, so the fixtures can
 * never drift from the real schema.
 */

const REAL = join(process.cwd(), 'content');
const dirs: string[] = [];

function scratch(): { contentDir: string; figuresDir: string; amc: string } {
  const root = mkdtempSync(join(tmpdir(), 'amc-rules-'));
  dirs.push(root);
  const contentDir = join(root, 'content');
  cpSync(join(REAL, 'amc'), join(contentDir, 'amc'), { recursive: true });
  const figuresDir = join(root, 'figures');
  mkdirSync(figuresDir);
  writeFileSync(join(figuresDir, 'RealFigure.tsx'), 'export {};\n');
  return { contentDir, figuresDir, amc: join(contentDir, 'amc') };
}

type Json = Record<string, unknown>;
const readJson = (file: string): Json => JSON.parse(readFileSync(file, 'utf8')) as Json;
const writeJson = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value));

function edit(file: string, change: (value: Json) => void): void {
  const value = readJson(file);
  change(value);
  writeJson(file, value);
}

function rulesFired(dir: { contentDir: string; figuresDir: string }): AmcRuleId[] {
  return validateAmcContent(dir).findings.map((f) => f.rule);
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('AMC content rules', () => {
  it('the committed content/amc/ is clean', () => {
    const result = validateAmcContent({
      contentDir: REAL,
      figuresDir: join(process.cwd(), 'src', 'components', 'figures'),
    });
    expect(result.findings.map((f) => `${f.rule} @ ${f.file}: ${f.message}`)).toEqual([]);
    expect(result.counts.problems).toBeGreaterThanOrEqual(3);
  });

  it('is silent when there is no content/amc/ at all', () => {
    const root = mkdtempSync(join(tmpdir(), 'amc-none-'));
    dirs.push(root);
    expect(validateAmcContent({ contentDir: root }).findings).toEqual([]);
  });

  it('GUARDRAIL: fires on a wrong choice with no misconception, with a message that explains', () => {
    const dir = scratch();
    edit(join(dir.amc, 'problems/10/AM-0999.json'), (p) => {
      const choices = p.choices as Json[];
      (choices[0] as Json).misconception = null;
    });
    const finding = validateAmcContent(dir).findings.find(
      (f) => f.rule === 'amc/misconception-required',
    );
    expect(finding?.message).toMatch(/product/);
  });

  it('fires on a figure with no alt text and on a figure component with no file', () => {
    const dir = scratch();
    edit(join(dir.amc, 'problems/10/AM-0999.json'), (p) => {
      p.figure = { component: 'MissingFigure', alt: 'short' };
    });
    expect(rulesFired(dir)).toContain('amc/figure-alt-required');

    edit(join(dir.amc, 'problems/10/AM-0999.json'), (p) => {
      p.figure = { component: 'MissingFigure', alt: 'A long enough description of the figure.' };
    });
    expect(rulesFired(dir)).toEqual(['amc/figure-component-exists']);

    edit(join(dir.amc, 'problems/10/AM-0999.json'), (p) => {
      p.figure = { component: 'RealFigure', alt: 'A long enough description of the figure.' };
    });
    expect(rulesFired(dir)).toEqual([]);
  });

  it('fires when the folder disagrees with the contest', () => {
    const dir = scratch();
    edit(join(dir.amc, 'problems/10/AM-0999.json'), (p) => {
      p.contest = 'AMC12';
    });
    expect(rulesFired(dir)).toContain('amc/problem-id-matches-path');
  });

  it('wants AMC 8 problems in 8/, and nothing else there', () => {
    const misfiled = scratch();
    edit(join(misfiled.amc, 'problems/10/AM-0999.json'), (p) => {
      p.contest = 'AMC8';
    });
    expect(rulesFired(misfiled)).toContain('amc/problem-id-matches-path');

    const intruder = scratch();
    edit(join(intruder.amc, 'problems/8/AM-1997.json'), (p) => {
      p.contest = 'BOTH';
    });
    expect(rulesFired(intruder)).toContain('amc/problem-id-matches-path');
  });

  it('keeps AMC 12 only topics off AMC 8, and allows AMC 8 on ordinary topics', () => {
    const dir = scratch();
    edit(join(dir.amc, 'problems/8/AM-1998.json'), (p) => {
      p.topic = 'ALG-06';
    });
    const findings = validateAmcContent(dir).findings.filter((f) => f.rule === 'amc/topic-contest');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/may not appear on AMC 8/);

    const clean = scratch();
    edit(join(clean.amc, 'problems/8/AM-1998.json'), (p) => {
      p.topic = 'ALG-01';
    });
    expect(rulesFired(clean)).toEqual([]);
  });

  it('fires when the file name disagrees with the id, and on a duplicate id', () => {
    const dir = scratch();
    const source = readJson(join(dir.amc, 'problems/10/AM-0999.json'));
    writeJson(join(dir.amc, 'problems/10/AM-0001.json'), source);
    const fired = rulesFired(dir);
    expect(fired).toContain('amc/problem-id-matches-path');
    expect(fired).toContain('amc/problem-duplicate-id');
  });

  it.each<[string, (p: Json) => void, AmcRuleId]>([
    ['an unknown topic', (p) => (p.topic = 'CP-99'), 'amc/topic-exists'],
    ['a topic from another area', (p) => (p.topic = 'ALG-01'), 'amc/topic-area-matches'],
    [
      'an AMC 12 only topic on an AMC 10 problem',
      (p) => {
        p.area = 'ALG';
        p.topic = 'ALG-06';
      },
      'amc/topic-contest',
    ],
    ['an unknown problem type', (p) => (p.types = ['T-NOPE']), 'amc/type-exists'],
    ['a repeated problem type', (p) => (p.types = ['T-PIE', 'T-PIE']), 'amc/type-exists'],
    ['an unknown formula', (p) => (p.formulas = ['F-CP-99']), 'amc/formula-exists'],
    [
      'two correct choices',
      (p) => {
        const choices = p.choices as Json[];
        Object.assign(choices[0] as Json, { correct: true, misconception: null });
      },
      'amc/problem-exactly-one-correct',
    ],
    [
      'a repeated choice key',
      (p) => {
        ((p.choices as Json[])[1] as Json).key = 'A';
      },
      'amc/problem-choice-keys',
    ],
    ['a schema violation', (p) => (p.slot = 30), 'amc/schema-problem'],
  ])('fires on %s', (_label, change, rule) => {
    const dir = scratch();
    edit(join(dir.amc, 'problems/10/AM-0999.json'), change);
    expect(rulesFired(dir)).toContain(rule);
  });

  it('checks formula files: path, dollars and type references', () => {
    const dir = scratch();
    edit(join(dir.amc, 'formulas/NT/F-NT-01.json'), (f) => {
      f.formula = '$d(n) = (a+1)(b+1)$';
      f.types = ['T-NOPE'];
    });
    const source = readJson(join(dir.amc, 'formulas/NT/F-NT-01.json'));
    writeJson(join(dir.amc, 'formulas/GEO/F-NT-01.json'), source);
    const fired = rulesFired(dir);
    expect(fired).toContain('amc/formula-no-dollars');
    expect(fired).toContain('amc/type-exists');
    expect(fired).toContain('amc/formula-id-matches-path');
    expect(fired).toContain('amc/formula-duplicate-id');
  });

  it('checks the taxonomy: areas, duplicate ids and topic prefixes', () => {
    const dir = scratch();
    edit(join(dir.amc, 'taxonomy.json'), (t) => {
      const topics = t.topics as Json[];
      const first = topics[0] as Json;
      topics.push({ ...first });
      (topics[1] as Json).area = 'GEO';
      const areas = t.areas as Json[];
      (areas[0] as Json).id = 'GEO';
    });
    const fired = rulesFired(dir);
    expect(fired).toContain('amc/taxonomy-areas');
    expect(fired).toContain('amc/taxonomy-duplicate-id');
    expect(fired).toContain('amc/topic-area-prefix');
  });

  it('reports a missing taxonomy', () => {
    const dir = scratch();
    rmSync(join(dir.amc, 'taxonomy.json'));
    expect(rulesFired(dir)).toContain('amc/taxonomy-missing');
  });
});
