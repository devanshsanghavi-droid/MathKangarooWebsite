import { EMPTY_PROGRESS, type ProgressFile, type SessionRecord } from './local-progress';
import type { AttemptRecord } from './mastery';
import type { BankSpec } from './progress-analytics';

/**
 * The demo student behind `/progress?demo=1` (docs/08 item 7): eight weeks of sample practice
 * and tests across Kangaroo, the AMC 8 and the AMC 10, improving over time.
 *
 * Built in memory from a seeded generator, so the same day always gives the same student,
 * and from real problem ids (the page's build-time bank descriptions and a short Kangaroo
 * list), so every Review and Practice link opens real questions. It is NEVER written to
 * localStorage or synced: the page hands it straight to the analytics as a prop. No name, no
 * identifier: it is a pattern of answers, not a person.
 */

/** A Kangaroo problem the demo may use: id, the skill buckets it is stored under, its points. */
export interface DemoKaProblem {
  id: string;
  skills: readonly string[];
  points: 3 | 4 | 5;
}

export interface DemoInput {
  banks: readonly BankSpec[];
  kaProblems: readonly DemoKaProblem[];
  now: Date;
  seed?: number;
}

export const DEMO_SEED = 20261140;
export const DEMO_WEEKS = 8;

/** A small, fast, seeded PRNG (mulberry32): the same seed gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type DemoExam = 'KA' | 'AMC8' | 'AMC10';

interface PoolItem {
  id: string;
  keys: string[];
  points: 3 | 4 | 5;
  section: string;
}

/** How likely a right answer is in each section at the start; growth is added over 8 weeks. */
const SECTION_BASE = [0.4, 0.8, 0.56, 0.86, 0.46, 0.66, 0.82];
const GROWTH = 0.2;
const DAYS = DEMO_WEEKS * 7;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function pools(banks: readonly BankSpec[], ka: readonly DemoKaProblem[]) {
  const out: Record<DemoExam, PoolItem[]> = {
    KA: ka.flatMap((p) => {
      const first = p.skills[0];
      return first
        ? [{ id: p.id, keys: [...p.skills], points: p.points, section: first.slice(0, 3) }]
        : [];
    }),
    AMC8: [],
    AMC10: [],
  };
  const amc = banks.find((b) => b.bank === 'AMC');
  if (amc) {
    const areaOf = new Map<string, string>();
    for (const section of amc.sections)
      for (const sub of section.subs) areaOf.set(sub.id, section.id);
    for (const group of amc.groups) {
      if (group.meta !== 'AMC8' && group.meta !== 'AMC10') continue;
      const area = group.sub ? areaOf.get(group.sub) : undefined;
      if (!area) continue;
      for (const id of group.ids) {
        out[group.meta].push({ id, keys: [id], points: 4, section: area });
      }
    }
    out.AMC8.sort((a, b) => a.id.localeCompare(b.id));
    out.AMC10.sort((a, b) => a.id.localeCompare(b.id));
  }
  return out;
}

function baseFor(pool: readonly PoolItem[]): Map<string, number> {
  const sections = [...new Set(pool.map((p) => p.section))].sort();
  return new Map(sections.map((s, i) => [s, SECTION_BASE[i % SECTION_BASE.length] ?? 0.7]));
}

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

interface PlannedTest {
  daysAgo: number;
  exam: DemoExam;
  kind: 'mock' | 'section';
  /** Share answered right. */
  target: number;
}

/** Scores climb across the eight weeks; a section test targets that exam's weakest section. */
const TESTS: readonly PlannedTest[] = [
  { daysAgo: 52, exam: 'KA', kind: 'mock', target: 0.5 },
  { daysAgo: 47, exam: 'AMC8', kind: 'mock', target: 0.44 },
  { daysAgo: 40, exam: 'AMC10', kind: 'mock', target: 0.36 },
  { daysAgo: 33, exam: 'AMC8', kind: 'mock', target: 0.52 },
  { daysAgo: 31, exam: 'KA', kind: 'mock', target: 0.62 },
  { daysAgo: 24, exam: 'KA', kind: 'section', target: 0.6 },
  { daysAgo: 19, exam: 'AMC8', kind: 'mock', target: 0.6 },
  { daysAgo: 13, exam: 'AMC10', kind: 'mock', target: 0.48 },
  { daysAgo: 11, exam: 'AMC8', kind: 'section', target: 0.7 },
  { daysAgo: 9, exam: 'KA', kind: 'mock', target: 0.74 },
  { daysAgo: 4, exam: 'AMC8', kind: 'mock', target: 0.68 },
];

const MOCK_SIZE: Record<DemoExam, { questions: number; blanks: number; minutes: number }> = {
  KA: { questions: 30, blanks: 0, minutes: 75 },
  AMC8: { questions: 25, blanks: 0, minutes: 40 },
  AMC10: { questions: 25, blanks: 3, minutes: 75 },
};

/**
 * The demo progress file for the day holding `now`. Deterministic: the same inputs give the
 * same file, attempts and sessions oldest first, nothing dated after `now`.
 */
export function demoProgress({
  banks,
  kaProblems,
  now,
  seed = DEMO_SEED,
}: DemoInput): ProgressFile {
  const rand = seededRandom(seed);
  const pool = pools(banks, kaProblems);
  const base: Record<DemoExam, Map<string, number>> = {
    KA: baseFor(pool.KA),
    AMC8: baseFor(pool.AMC8),
    AMC10: baseFor(pool.AMC10),
  };
  const exams = (['KA', 'AMC8', 'AMC10'] as const).filter((e) => pool[e].length > 0);
  const weight: Record<DemoExam, number> = { KA: 0.45, AMC8: 0.35, AMC10: 0.2 };
  const totalWeight = exams.reduce((n, e) => n + weight[e], 0);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nowMs = now.getTime();
  const dayAt = (daysAgo: number, hour: number, minute = 0): Date => {
    const d = new Date(midnight);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const all: Array<{ keys: string[]; attempt: AttemptRecord }> = [];
  const sessions: SessionRecord[] = [];

  // Practice: most days, a handful of questions in the late afternoon.
  for (let daysAgo = DAYS - 1; daysAgo >= 0 && exams.length > 0; daysAgo -= 1) {
    const progress = (DAYS - 1 - daysAgo) / (DAYS - 1);
    if (rand() > 0.5 + 0.25 * progress) continue;
    const count = 5 + Math.floor(rand() * 10);
    let t = dayAt(daysAgo, 16, Math.floor(rand() * 90)).getTime();
    for (let i = 0; i < count; i += 1) {
      let pick = rand() * totalWeight;
      const exam = exams.find((e) => (pick -= weight[e]) < 0) ?? exams[0] ?? 'KA';
      const list = pool[exam];
      const item = list[Math.floor(rand() * list.length)];
      if (!item) continue;
      const p = clamp((base[exam].get(item.section) ?? 0.7) + GROWTH * progress, 0.1, 0.95);
      const correct = rand() < p;
      const ms = Math.round((25 + rand() * 95) * 1000 * (correct ? 0.9 : 1.15));
      t += ms + 15_000;
      if (t > nowMs - 60_000) break;
      all.push({
        keys: item.keys,
        attempt: {
          problemId: item.id,
          points: item.points,
          correct,
          hintsUsed: rand() < 0.1 ? 1 : 0,
          at: new Date(t).toISOString(),
          ms,
          mode: 'practice',
        },
      });
    }
  }

  // Tests: each answered question is also a 'test' attempt stamped with the finish time,
  // exactly as the exam engine records them, so Review can find them again.
  for (const plan of TESTS) {
    const list = pool[plan.exam];
    if (list.length === 0) continue;
    const finished = dayAt(plan.daysAgo, 18, 30);
    if (finished.getTime() > nowMs) continue;
    const at = finished.toISOString();
    let chosen: PoolItem[];
    let blanks = 0;
    let minutes: number;
    let section: string | undefined;
    if (plan.kind === 'mock') {
      const size = MOCK_SIZE[plan.exam];
      chosen = shuffled(list, rand).slice(0, size.questions - size.blanks);
      blanks = size.blanks;
      minutes = size.minutes * (0.75 + rand() * 0.2);
    } else {
      // The weakest section at the start.
      const weakest = [...base[plan.exam].entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
      section = weakest;
      chosen = shuffled(
        list.filter((p) => p.section === weakest),
        rand,
      ).slice(0, 10);
      minutes = 10 + rand() * 4;
    }
    if (chosen.length === 0) continue;
    const durationMs = Math.round(minutes * 60_000);
    const right = Math.round(plan.target * chosen.length);
    const correctIds = new Set(
      shuffled(chosen, rand)
        .slice(0, right)
        .map((p) => p.id),
    );
    let pointsRight = 0;
    let pointsAll = 0;
    for (const item of chosen) {
      const correct = correctIds.has(item.id);
      pointsAll += item.points;
      if (correct) pointsRight += item.points;
      all.push({
        keys: item.keys,
        attempt: {
          problemId: item.id,
          points: item.points,
          correct,
          hintsUsed: 0,
          at,
          ms: Math.round((durationMs / (chosen.length + blanks)) * (0.6 + rand() * 0.8)),
          mode: 'test',
        },
      });
    }
    const total = chosen.length + blanks;
    let score: number;
    let max: number;
    if (plan.kind === 'section') {
      score = right;
      max = total;
    } else if (plan.exam === 'KA') {
      score = pointsRight;
      max = pointsAll;
    } else if (plan.exam === 'AMC10') {
      score = 6 * right + 1.5 * blanks;
      max = 6 * total;
    } else {
      score = right;
      max = total;
    }
    const session: SessionRecord = {
      kind: plan.kind,
      exam: plan.exam,
      at,
      score,
      max,
      correct: right,
      total,
      durationMs,
    };
    if (section) session.section = section;
    sessions.push(session);
  }

  all.sort(
    (a, b) =>
      a.attempt.at.localeCompare(b.attempt.at) ||
      a.attempt.problemId.localeCompare(b.attempt.problemId),
  );
  const attempts: Record<string, AttemptRecord[]> = {};
  for (const { keys, attempt } of all) {
    for (const key of keys) (attempts[key] ??= []).push(attempt);
  }
  sessions.sort((a, b) => a.at.localeCompare(b.at));
  return { version: EMPTY_PROGRESS.version, attempts, sessions };
}

/** Whether a query string asks for the demo student. */
export function isDemoSearch(search: string): boolean {
  return new URLSearchParams(search).get('demo') === '1';
}
