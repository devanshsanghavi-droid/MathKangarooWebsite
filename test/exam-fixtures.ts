import { getAllAmcProblems, getAmcTaxonomy } from '@/lib/amc-content';
import { buildAmcIndex, buildAmcLookups, dataPaths, type TestIndexFile } from '@/lib/bank-data';
import { amcPracticeItem, type TestPracticeItem } from '@/lib/practice-item';
import type { ChoiceKey } from '@/lib/schemas';
import type { TestDifficulty } from '@/lib/test-meta';
import { installStaticDataFetch } from './static-data';

/**
 * Static data for the exam-runner tests (mocks and section tests): the real AMC bank, plus a
 * synthetic SAT bank big enough for a full two-module mock, because the real SAT bank is still
 * being written. Every synthetic question's answer is A.
 */

const SAT_DOMAINS = [
  { id: 'ALG', name: 'Algebra', count: 30 },
  { id: 'ADV', name: 'Advanced Math', count: 30 },
  { id: 'PSD', name: 'Problem-Solving and Data Analysis', count: 12 },
  { id: 'GEO', name: 'Geometry and Trigonometry', count: 12 },
];
const DIFFICULTIES: readonly TestDifficulty[] = ['easy', 'medium', 'hard'];

function satItem(id: string, domain: string, difficulty: TestDifficulty): TestPracticeItem {
  const keys: ChoiceKey[] = ['A', 'B', 'C', 'D'];
  return {
    bank: 'sat',
    id,
    href: `/sat/problem/${id}`,
    statement: `Synthetic question ${id}: what is $1 + 1$?`,
    math: true,
    figure: null,
    choices: keys.map((key, index) => ({
      key,
      text: String(index + 2),
      correct: key === 'A',
      misconception: key === 'A' ? null : `I added the wrong numbers and got ${index + 2}.`,
    })),
    hints: ['Count.', 'Count again.', 'It is 2.'],
    solutions: { reliable: 'One and one make $2$.', elegant: null },
    whyOnTest: null,
    points: difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5,
    tierLabel: difficulty[0]?.toUpperCase() + difficulty.slice(1),
    estSeconds: 75,
    groups: [{ id: `${domain}-01`, name: `${domain} skill one` }],
    levelLabel: 'SAT Math',
    test: 'SAT',
    domain,
    skill: `${domain}-01`,
    difficulty,
  };
}

export function satFixture(): { index: TestIndexFile; items: TestPracticeItem[] } {
  const items: TestPracticeItem[] = [];
  let n = 9001;
  for (const domain of SAT_DOMAINS) {
    for (let k = 0; k < domain.count; k += 1) {
      items.push(satItem(`SA-${n}`, domain.id, DIFFICULTIES[k % 3] ?? 'easy'));
      n += 1;
    }
  }
  return {
    items,
    index: {
      version: 1,
      test: 'SAT',
      total: items.length,
      domains: SAT_DOMAINS.map((d) => ({
        id: d.id,
        name: d.name,
        count: d.count,
        skills: [{ id: `${d.id}-01`, name: `${d.id} skill one`, count: d.count }],
      })),
      rows: items.map((item) => ({
        id: item.id,
        domain: item.domain,
        skill: item.skill,
        difficulty: item.difficulty,
        statement: item.statement,
        hasFigure: false,
      })),
    },
  };
}

/** Serves the Kangaroo bank (via installStaticDataFetch), the real AMC bank and the SAT fixture. */
export function installExamData() {
  const problems = getAllAmcProblems();
  const taxonomy = getAmcTaxonomy();
  const topicName = (id: string) => taxonomy.topics.find((t) => t.id === id)?.name;
  const sat = satFixture();
  return installStaticDataFetch({
    [dataPaths.amcIndex]: buildAmcIndex(problems),
    [dataPaths.amcLookups]: buildAmcLookups(taxonomy, problems),
    [dataPaths.testIndex('SAT')]: sat.index,
    ...Object.fromEntries(
      problems.map((p) => [dataPaths.problem(p.id), amcPracticeItem(p, topicName)]),
    ),
    ...Object.fromEntries(sat.items.map((item) => [dataPaths.problem(item.id), item])),
  });
}
