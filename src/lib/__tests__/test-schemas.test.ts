import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TestProblemSchema,
  TestTaxonomySchema,
  isTestProblemId,
  testDomainOfSkill,
  testOfProblemId,
  testPointsOf,
  isTestDomain,
  type TestProblem,
} from '../test-schemas';
import { buildTestIndex, countTestProblems } from '../test-content';
import {
  isPracticeId,
  isTestBank,
  parsePracticeSetQuery,
  practiceSetHref,
  testPracticeItem,
} from '../practice-item';
import { buildTestIndexFile, testSkillNames } from '../bank-data';

const TESTS_DIR = join(process.cwd(), 'content', 'tests');
const sample = (test: 'sat' | 'act', id: string): TestProblem =>
  TestProblemSchema.parse(
    JSON.parse(readFileSync(join(TESTS_DIR, test, 'problems', `${id}.json`), 'utf8')),
  );

describe('test-meta helpers', () => {
  it('reads the test from an id prefix', () => {
    expect(testOfProblemId('SA-0001')).toBe('SAT');
    expect(testOfProblemId('AC-0300')).toBe('ACT');
    expect(testOfProblemId('AM-0001')).toBeNull();
    expect(testOfProblemId('KA-0001')).toBeNull();
    expect(isTestProblemId('SA-001')).toBe(false);
  });

  it('maps difficulty to progress points 3 / 4 / 5', () => {
    expect(testPointsOf('easy')).toBe(3);
    expect(testPointsOf('medium')).toBe(4);
    expect(testPointsOf('hard')).toBe(5);
  });

  it('reads a skill domain and checks domains per test', () => {
    expect(testDomainOfSkill('ADV-03')).toBe('ADV');
    expect(testDomainOfSkill('STAT-09')).toBe('STAT');
    expect(testDomainOfSkill('CP-01')).toBeNull();
    expect(isTestDomain('SAT', 'PSD')).toBe(true);
    expect(isTestDomain('SAT', 'STAT')).toBe(false);
    expect(isTestDomain('ACT', 'NQ')).toBe(true);
    expect(isTestDomain('ACT', 'ADV')).toBe(false);
  });
});

describe('TestProblemSchema', () => {
  const base = sample('sat', 'SA-0997');

  it('accepts the committed samples', () => {
    for (const [t, id] of [
      ['sat', 'SA-0997'],
      ['sat', 'SA-0998'],
      ['act', 'AC-0997'],
      ['act', 'AC-0998'],
    ] as const) {
      expect(() => sample(t, id)).not.toThrow();
    }
  });

  it('rejects five choices, a slot, a bad id and an unknown difficulty', () => {
    const fifth = { key: 'E', text: '1', correct: false, misconception: 'x'.repeat(30) };
    expect(
      TestProblemSchema.safeParse({ ...base, choices: [...base.choices, fifth] }).success,
    ).toBe(false);
    expect(TestProblemSchema.safeParse({ ...base, slot: 3 }).success).toBe(false);
    expect(TestProblemSchema.safeParse({ ...base, id: 'AM-0001' }).success).toBe(false);
    expect(TestProblemSchema.safeParse({ ...base, difficulty: 'expert' }).success).toBe(false);
  });

  it('parses both committed taxonomies', () => {
    for (const t of ['sat', 'act']) {
      const raw: unknown = JSON.parse(readFileSync(join(TESTS_DIR, t, 'taxonomy.json'), 'utf8'));
      expect(TestTaxonomySchema.safeParse(raw).success).toBe(true);
    }
  });
});

describe('test-content loader', () => {
  it('builds an index with counts by domain, skill and difficulty', () => {
    const index = buildTestIndex(join(TESTS_DIR, 'sat'), 'SAT');
    expect(index.problemById.get('SA-0997')?.skill).toBe('ALG-04');
    expect(index.skillById.get('ADV-04')?.domain).toBe('ADV');
    const counts = countTestProblems('SAT', [sample('sat', 'SA-0997'), sample('sat', 'SA-0998')]);
    expect(counts.total).toBe(2);
    expect(counts.byDomain.get('ALG')).toBe(1);
    expect(counts.byDomain.get('PSD')).toBe(0);
    expect(counts.bySkill.get('ADV-04')).toBe(1);
    expect(counts.byDifficulty.get('medium')).toBe(2);
  });

  it('refuses a taxonomy loaded as the wrong test', () => {
    expect(() => buildTestIndex(join(TESTS_DIR, 'sat'), 'ACT')).toThrow(/expected ACT/);
  });
});

describe('practice adapter and static index', () => {
  it('adapts a SAT problem into a practice item', () => {
    const item = testPracticeItem(sample('sat', 'SA-0997'), (id) =>
      id === 'ALG-04' ? 'Systems of linear equations' : undefined,
    );
    expect(item.bank).toBe('sat');
    expect(item.href).toBe('/sat/problem/SA-0997');
    expect(item.points).toBe(4);
    expect(item.tierLabel).toBe('Medium');
    expect(item.levelLabel).toBe('SAT Math');
    expect(item.math).toBe(true);
    expect(item.groups).toEqual([{ id: 'ALG-04', name: 'Systems of linear equations' }]);
    expect(isTestBank(item.bank)).toBe(true);
  });

  it('adapts an ACT problem, falling back to the skill id as its name', () => {
    const item = testPracticeItem(sample('act', 'AC-0997'), () => undefined);
    expect(item.bank).toBe('act');
    expect(item.points).toBe(3);
    expect(item.groups[0]).toEqual({ id: 'STAT-01', name: 'STAT-01' });
  });

  it('round-trips SAT and ACT practice-set URLs and keeps banks apart', () => {
    const href = practiceSetHref({ bank: 'sat', ids: ['SA-0997', 'SA-0998'] });
    expect(href).toBe('/sat/practice?bank=sat&ids=SA-0997,SA-0998');
    const query = parsePracticeSetQuery(href.split('?')[1] ?? '');
    expect(query).toEqual({ bank: 'sat', ids: ['SA-0997', 'SA-0998'], name: '' });
    expect(parsePracticeSetQuery('bank=act&ids=AC-0001,SA-0001').ids).toEqual(['AC-0001']);
    expect(isPracticeId('act', 'SA-0001')).toBe(false);
    expect(practiceSetHref({ bank: 'act', ids: ['AC-0001'] })).toBe(
      '/act/practice?bank=act&ids=AC-0001',
    );
  });

  it('builds the static index file with per-domain and per-skill counts', () => {
    const index = buildTestIndex(join(TESTS_DIR, 'act'), 'ACT');
    const file = buildTestIndexFile(index.taxonomy, [
      sample('act', 'AC-0997'),
      sample('act', 'AC-0998'),
    ]);
    expect(file.test).toBe('ACT');
    expect(file.total).toBe(2);
    expect(file.rows.map((r) => r.id)).toEqual(['AC-0997', 'AC-0998']);
    expect(file.domains.map((d) => d.id)).toEqual(['NQ', 'ALG', 'FUN', 'GEO', 'STAT']);
    expect(file.domains.find((d) => d.id === 'STAT')?.count).toBe(1);
    expect(testSkillNames(file).get('NQ-06')).toBe('Complex numbers');
  });
});
