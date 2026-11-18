import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeStaticData } from '../lib/static-data.ts';
import bundle from '../../src/lib/content.bundle.json';
import type { Problem, Skill } from '../../src/lib/schemas.ts';
import type {
  AmcIndexFile,
  AmcLookups,
  KaIndexFile,
  KaLookups,
  TestIndexFile,
} from '../../src/lib/bank-data.ts';
import { previewMath, previewText, STATEMENT_PREVIEW_MAX } from '../../src/lib/bank-data.ts';
import type {
  AmcPracticeItem,
  KaPracticeItem,
  TestPracticeItem,
} from '../../src/lib/practice-item.ts';

/**
 * scripts/build-static-data.ts against a fixture content tree. The fixture is cut from the
 * committed content bundle (a stable snapshot) plus a hand-written AMC taxonomy and problem,
 * so the test does not move when content/ is being edited.
 */

const skills = (bundle as unknown as { skills: Skill[] }).skills;
const problems = (bundle as unknown as { problems: Problem[] }).problems.slice(0, 6);

let root: string;
let contentDir: string;
let outDir: string;

function writeJson(path: string, value: unknown) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ka-static-data-'));
  contentDir = join(root, 'content');
  outDir = join(root, 'public', 'data');
  for (const skill of skills)
    writeJson(join(contentDir, 'skills', skill.strand, `${skill.id}.json`), skill);
  for (const problem of problems) {
    writeJson(join(contentDir, 'problems', problem.band, `${problem.id}.json`), problem);
  }
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('the Kangaroo files', () => {
  it('writes an index row, the lookups and a practice item per problem', () => {
    const result = writeStaticData({ contentDir, outDir });
    expect(result).toEqual({
      ka: { problems: problems.length, skills: skills.length },
      amc: null,
      tests: {},
      files: problems.length + 2,
    });

    const index = readJson<KaIndexFile>(join(outDir, 'ka-index.json'));
    expect(index.version).toBe(1);
    expect(index.rows.map((row) => row.id)).toEqual(problems.map((p) => p.id).sort());
    const first = problems[0] as Problem;
    expect(index.rows.find((row) => row.id === first.id)).toEqual({
      id: first.id,
      band: first.band,
      points: first.points,
      statement: previewText(first.statement),
      hasFigure: first.figure !== null,
      primary: first.skills.primary,
      secondary: first.skills.secondary,
      strand: first.skills.primary.slice(0, 3),
    });

    const lookups = readJson<KaLookups>(join(outDir, 'ka-lookups.json'));
    expect(lookups.total).toBe(problems.length);
    expect(lookups.strands.map((strand) => strand.id)).toEqual([
      'NUM',
      'CNT',
      'GEO',
      'LOG',
      'PAT',
      'MOD',
      'CFT',
    ]);
    expect(lookups.strands.flatMap((strand) => strand.skills)).toHaveLength(skills.length);

    const item = readJson<KaPracticeItem>(join(outDir, 'p', `${first.id}.json`));
    expect(item.bank).toBe('ka');
    expect(item.href).toBe(`/problem/${first.id}`);
    expect(item.choices).toEqual(first.choices);
    expect(item.hints).toEqual(first.hints);
    expect(item.skillIds).toEqual([first.skills.primary, ...first.skills.secondary]);
    expect(item.groups[0]?.name).toBe(skills.find((s) => s.id === first.skills.primary)?.name);
  });

  it('starts clean, so a retired problem leaves no file behind', () => {
    mkdirSync(join(outDir, 'p'), { recursive: true });
    writeFileSync(join(outDir, 'p', 'KA-9999.json'), '{}');
    writeStaticData({ contentDir, outDir });
    expect(existsSync(join(outDir, 'p', 'KA-9999.json'))).toBe(false);
    expect(readdirSync(join(outDir, 'p'))).toHaveLength(problems.length);
  });

  it('refuses invalid content rather than publishing it', () => {
    writeJson(join(contentDir, 'problems', '3-4', 'KA-0999.json'), { id: 'KA-0999' });
    expect(() => writeStaticData({ contentDir, outDir })).toThrow(/KA-0999/);
  });
});

describe('the AMC files', () => {
  beforeEach(() => {
    writeJson(join(contentDir, 'amc', 'taxonomy.json'), AMC_TAXONOMY);
    writeJson(join(contentDir, 'amc', 'problems', '10', 'AM-0001.json'), AMC_PROBLEM);
  });

  it('writes the AMC index, lookups and practice items when content/amc exists', () => {
    const result = writeStaticData({ contentDir, outDir });
    expect(result.amc).toEqual({ problems: 1 });
    expect(result.files).toBe(problems.length + 2 + 1 + 2);

    const index = readJson<AmcIndexFile>(join(outDir, 'amc-index.json'));
    expect(index.rows).toEqual([
      {
        id: 'AM-0001',
        contest: 'BOTH',
        slot: 14,
        tier: 'Middle',
        area: 'ALG',
        topic: 'ALG-01',
        types: ['T-WORKING-BACKWARDS'],
        statement: AMC_PROBLEM.statement,
        hasFigure: false,
      },
    ]);

    const lookups = readJson<AmcLookups>(join(outDir, 'amc-lookups.json'));
    expect(lookups.areas.map((area) => area.id)).toEqual(['ALG', 'GEO', 'NT', 'CP']);
    expect(lookups.areas[0]?.topics).toEqual([
      { id: 'ALG-01', name: 'Linear equations', amc12Only: false },
    ]);

    const item = readJson<AmcPracticeItem>(join(outDir, 'p', 'AM-0001.json'));
    expect(item).toMatchObject({
      bank: 'amc',
      href: '/amc/problem/AM-0001',
      math: true,
      points: 4,
      tierLabel: 'Middle (slots 11-20)',
      levelLabel: 'AMC 10 and 12',
      groups: [{ id: 'ALG-01', name: 'Linear equations' }],
    });
  });

  it('runs as the prebuild CLI with the paths from the environment', () => {
    const run = spawnSync(process.execPath, ['scripts/build-static-data.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, CONTENT_DIR: contentDir, STATIC_DATA_DIR: outDir },
      encoding: 'utf8',
    });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/1 AMC problems/);
    expect(existsSync(join(outDir, 'amc-index.json'))).toBe(true);
  });
});

describe('statement previews', () => {
  it('cuts plain text at a word boundary', () => {
    const long = 'word '.repeat(100);
    const preview = previewText(long);
    expect(preview.length).toBeLessThanOrEqual(STATEMENT_PREVIEW_MAX);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview).not.toMatch(/wor…$/);
  });

  it('never cuts inside a formula', () => {
    const text = `${'a '.repeat(100)}$\\frac{1}{2} + \\frac{1}{3}$ and more text after it.`;
    const preview = previewMath(text, 210);
    expect((preview.match(/\$/g) ?? []).length % 2).toBe(0);
  });
});

const AMC_TAXONOMY = {
  areas: [
    {
      id: 'ALG',
      name: 'Algebra',
      description: 'Equations, functions, sequences and the algebra that holds a problem together.',
    },
    {
      id: 'GEO',
      name: 'Geometry',
      description: 'Lengths, angles, areas and volumes, with and without coordinates in the plane.',
    },
    {
      id: 'NT',
      name: 'Number theory',
      description: 'Divisibility, primes, remainders and digits, the arithmetic of whole numbers.',
    },
    {
      id: 'CP',
      name: 'Counting and probability',
      description: 'Arrangements, selections and chances, counted carefully and without overlap.',
    },
  ],
  topics: [
    {
      id: 'ALG-01',
      name: 'Linear equations',
      area: 'ALG',
      description: 'Solving one or two linear equations, and setting them up from a story first.',
      amc12Only: false,
    },
  ],
  types: [
    {
      id: 'T-WORKING-BACKWARDS',
      name: 'Working backwards',
      description:
        'Start from the end state and undo each step in reverse order to recover the start.',
      recognizeWhen: [
        'the final result of a process is given',
        'each step can be undone exactly',
        'the question asks for the starting value',
      ],
      areas: ['ALG'],
    },
  ],
};

const AMC_PROBLEM = {
  id: 'AM-0001',
  contest: 'BOTH',
  slot: 14,
  area: 'ALG',
  topic: 'ALG-01',
  types: ['T-WORKING-BACKWARDS'],
  statement: 'A number is doubled and then $7$ is added, giving $31$. What was the number?',
  figure: null,
  choices: [
    {
      key: 'A',
      text: '$10$',
      correct: false,
      misconception: 'I subtracted 7 from 31 and then took away 14 instead of halving the 24.',
    },
    { key: 'B', text: '$12$', correct: true, misconception: null },
    {
      key: 'C',
      text: '$19$',
      correct: false,
      misconception: 'I halved 31 to get about 15.5 and then added 7 back on and rounded off.',
    },
    {
      key: 'D',
      text: '$24$',
      correct: false,
      misconception: 'I subtracted 7 from 31 and forgot to undo the doubling at the end.',
    },
    {
      key: 'E',
      text: '$69$',
      correct: false,
      misconception: 'I doubled 31 and added 7 again instead of undoing the two steps.',
    },
  ],
  hints: [
    'Undo the last step first.',
    'Subtract the 7, then undo the doubling.',
    'Subtracting 7 from 31 gives 24, and half of 24 is 12.',
  ],
  solutions: {
    reliable:
      'Work backwards: before adding 7 the value was $31 - 7 = 24$, and before doubling it was $24 / 2 = 12$.',
    elegant: null,
  },
  formulas: [],
  estSeconds: 60,
  calibration: { pValue: null, medianMs: null, n: 0 },
  author: 'Test Author',
  reviewedBy: ['pending-review'],
  createdAt: '2026-11-14',
  license: 'CC-BY-NC-SA-4.0',
};

describe('the SAT / ACT files', () => {
  it('writes <slug>-index.json and a practice item per SA / AC problem', () => {
    cpSync(join(process.cwd(), 'content', 'tests'), join(contentDir, 'tests'), {
      recursive: true,
    });
    const result = writeStaticData({ contentDir, outDir });
    const sat = readJson<TestIndexFile>(join(outDir, 'sat-index.json'));
    const act = readJson<TestIndexFile>(join(outDir, 'act-index.json'));
    expect(result.tests).toEqual({ SAT: sat.rows.length, ACT: act.rows.length });
    expect(sat.test).toBe('SAT');
    expect(sat.rows.some((row) => row.id === 'SA-0997')).toBe(true);
    expect(act.domains.map((d) => d.id)).toEqual(['NQ', 'ALG', 'FUN', 'GEO', 'STAT']);
    const item = readJson<TestPracticeItem>(join(outDir, 'p', 'AC-0998.json'));
    expect(item.bank).toBe('act');
    expect(item.groups[0]).toEqual({ id: 'NQ-06', name: 'Complex numbers' });
  });
});
