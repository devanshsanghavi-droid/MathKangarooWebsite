import 'server-only';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { getAmcProblemsFor, getAmcTaxonomy } from '@/lib/amc-content';
import { getAllTestProblems, getTestTaxonomy } from '@/lib/test-content';
import { amcBankSpec, kangarooBankSpec, testBankSpec } from '@/lib/progress-banks';
import type { BankSpec } from '@/lib/progress-analytics';
import { topicName, type Exam } from '@/lib/exams';

/**
 * What an exam page (docs/08 item 3) needs from the content, read at build time: the exam's
 * topics in taxonomy order with their question counts, and the compact bank description the
 * browser uses to work out the student's accuracy per topic (progress-analytics.ts).
 *
 *   Kangaroo   topics are strands; counts per level as well, for the level picker. A problem
 *              counts in the strand of its primary skill.
 *   AMC        topics are areas, counted over the problems on that paper (a problem shared by
 *              the AMC 10 and 12 counts on both); the spec holds only that paper's problems,
 *              so another paper's answers never colour this page.
 *   SAT, ACT   topics are domains.
 *
 * Names go through topicName(), so an exam's own wording ("Arithmetic and algebra" on the
 * AMC 8) wins over the taxonomy's. Only ids, names and counts travel to the browser.
 */

export interface ExamTopicRow {
  id: string;
  name: string;
  count: number;
}

export interface ExamPageData {
  /** Every topic with at least one question, across the whole exam (every Kangaroo level). */
  topics: ExamTopicRow[];
  /** Kangaroo only: the same rows per level id ('3-4'), zero-count topics dropped. */
  byTrack: Record<string, ExamTopicRow[]>;
  total: number;
  /** Kangaroo only: questions per level. */
  totalByTrack: Record<string, number>;
  /** For the accuracy column; null for a soon exam. */
  spec: BankSpec | null;
}

const EMPTY: ExamPageData = { topics: [], byTrack: {}, total: 0, totalByTrack: {}, spec: null };

function rows(
  exam: Exam,
  sections: ReadonlyArray<{ id: string; name: string }>,
  countOf: (sectionId: string) => number,
): ExamTopicRow[] {
  return sections
    .map((section) => ({
      id: section.id,
      name: topicName(exam, section.id, section.name),
      count: countOf(section.id),
    }))
    .filter((row) => row.count > 0);
}

function tally<T>(
  items: readonly T[],
  keyOf: (item: T) => string | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function kangarooData(exam: Exam): ExamPageData {
  const skills = getAllSkills();
  const problems = getAllProblems();
  const spec = kangarooBankSpec(skills, problems);
  const strandOf = new Map(skills.map((skill) => [skill.id, skill.strand as string]));
  const strandOfProblem = (problem: (typeof problems)[number]) =>
    strandOf.get(problem.skills.primary);

  const all = tally(problems, strandOfProblem);
  const byTrack: Record<string, ExamTopicRow[]> = {};
  const totalByTrack: Record<string, number> = {};
  for (const track of exam.tracks) {
    const inTrack = problems.filter((problem) => problem.band === track.id);
    const counts = tally(inTrack, strandOfProblem);
    byTrack[track.id] = rows(exam, spec.sections, (id) => counts.get(id) ?? 0);
    totalByTrack[track.id] = inTrack.length;
  }
  return {
    topics: rows(exam, spec.sections, (id) => all.get(id) ?? 0),
    byTrack,
    total: problems.length,
    totalByTrack,
    spec,
  };
}

/** Build-time only: reads the content folders. */
export function examPageData(exam: Exam): ExamPageData {
  switch (exam.sessionExam) {
    case null:
      return EMPTY;
    case 'KA':
      return kangarooData(exam);
    case 'AMC8':
    case 'AMC10':
    case 'AMC12': {
      const taxonomy = getAmcTaxonomy();
      const problems = getAmcProblemsFor(exam.sessionExam);
      const spec = amcBankSpec(taxonomy, problems);
      const counts = tally(problems, (problem) => problem.area);
      return {
        topics: rows(exam, spec.sections, (id) => counts.get(id) ?? 0),
        byTrack: {},
        total: problems.length,
        totalByTrack: {},
        spec,
      };
    }
    case 'SAT':
    case 'ACT': {
      const problems = getAllTestProblems(exam.sessionExam);
      const spec = testBankSpec(getTestTaxonomy(exam.sessionExam), problems);
      const counts = tally(problems, (problem) => problem.domain);
      return {
        topics: rows(exam, spec.sections, (id) => counts.get(id) ?? 0),
        byTrack: {},
        total: problems.length,
        totalByTrack: {},
        spec,
      };
    }
  }
}

/** Questions per live exam, for the catalog cards: cheaper than examPageData, same numbers. */
export function examQuestionCount(exam: Exam): number {
  switch (exam.sessionExam) {
    case null:
      return 0;
    case 'KA':
      return getAllProblems().length;
    case 'AMC8':
    case 'AMC10':
    case 'AMC12':
      return getAmcProblemsFor(exam.sessionExam).length;
    case 'SAT':
    case 'ACT':
      return getAllTestProblems(exam.sessionExam).length;
  }
}
