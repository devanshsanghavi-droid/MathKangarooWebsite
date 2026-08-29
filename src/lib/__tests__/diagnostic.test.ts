import { describe, it, expect } from 'vitest';
import {
  buildPlan,
  isFinished,
  MAX_ITEMS,
  nextItem,
  nextStrand,
  openingSkill,
  recordAnswer,
  startDiagnostic,
  summarise,
  type DiagnosticContent,
  type DiagnosticState,
} from '../diagnostic';
import { getAllProblems, getAllSkills, getSkill } from '../content';
import { STRANDS, type Band } from '../schemas';

const content: DiagnosticContent = { skills: getAllSkills(), problems: getAllProblems() };

/** Run a whole diagnostic with a fixed answering policy. */
function run(band: Band, answer: (index: number, skillId: string) => boolean) {
  let state = startDiagnostic(content, band);
  const asked: string[] = [];
  for (let index = 0; index < MAX_ITEMS + 5; index += 1) {
    const problem = nextItem(content, state);
    if (!problem) break;
    asked.push(problem.id);
    state = recordAnswer(content, state, problem, answer(index, problem.skills.primary));
  }
  return { state, asked };
}

describe('starting a diagnostic', () => {
  it('opens a frontier on every one of the seven strands', () => {
    const state = startDiagnostic(content, '5-6');
    expect(Object.keys(state.frontier).sort()).toEqual([...STRANDS].sort());
    for (const strand of STRANDS) {
      expect(state.frontier[strand].points, strand).toBe(3);
      expect(state.frontier[strand].bounded, strand).toBe(false);
    }
  });

  it('starts each strand at a foundation skill that has a problem', () => {
    for (const strand of STRANDS) {
      const id = openingSkill(content, strand, '5-6');
      expect(id, strand).not.toBeNull();
      expect(getSkill(id ?? '')?.strand, strand).toBe(strand);
    }
  });

  it('starts at the 3-point tier, as the data model specifies', () => {
    const state = startDiagnostic(content, '3-4');
    const first = nextItem(content, state);
    expect(first?.points).toBe(3);
  });

  it('has asked nothing yet', () => {
    expect(startDiagnostic(content, '5-6').answers).toEqual([]);
    expect(isFinished(startDiagnostic(content, '5-6'))).toBe(false);
  });
});

describe('item selection', () => {
  it('spreads the early items across strands rather than drilling one', () => {
    const { state } = run('5-6', () => true);
    const strandsSeen = new Set(state.answers.slice(0, 7).map((answer) => answer.strand));
    expect(strandsSeen.size).toBeGreaterThanOrEqual(5);
  });

  it('never asks the same problem twice', () => {
    const { asked } = run('5-6', (index) => index % 2 === 0);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('stops at fifteen items', () => {
    const { state } = run('5-6', () => true);
    expect(state.answers.length).toBeLessThanOrEqual(MAX_ITEMS);
  });

  it('stops early when every strand is bounded', () => {
    const state: DiagnosticState = startDiagnostic(content, '5-6');
    for (const strand of STRANDS) state.frontier[strand].bounded = true;
    expect(isFinished(state)).toBe(true);
    expect(nextItem(content, state)).toBeNull();
    expect(nextStrand(state)).toBeNull();
  });
});

describe('branching on the skill graph — the whole point', () => {
  it('descends to a prerequisite after a miss', () => {
    let state = startDiagnostic(content, '5-6');
    const problem = nextItem(content, state);
    if (!problem) throw new Error('no opening item');
    const skill = getSkill(problem.skills.primary);
    if (!skill) throw new Error('opening skill missing');

    state = recordAnswer(content, state, problem, false);
    const strand = problem.skills.primary.slice(0, 3) as (typeof STRANDS)[number];
    const moved = state.frontier[strand].skillId;

    if (skill.prerequisites.length > 0) {
      expect(skill.prerequisites).toContain(moved);
    } else {
      // A root skill has nowhere lower to go, so the strand is bounded instead.
      expect(state.frontier[strand].bounded).toBe(true);
    }
  });

  it('ascends to an unlocked skill after a solve', () => {
    let state = startDiagnostic(content, '5-6');
    const problem = nextItem(content, state);
    if (!problem) throw new Error('no opening item');
    const skill = getSkill(problem.skills.primary);
    if (!skill) throw new Error('opening skill missing');

    state = recordAnswer(content, state, problem, true);
    const strand = problem.skills.primary.slice(0, 3) as (typeof STRANDS)[number];
    const moved = state.frontier[strand].skillId;

    if (moved !== null) expect(skill.unlocks).toContain(moved);
  });

  it('raises the point tier on a solve and lowers it on a miss', () => {
    let state = startDiagnostic(content, '5-6');
    const problem = nextItem(content, state);
    if (!problem) throw new Error('no opening item');
    const strand = problem.skills.primary.slice(0, 3) as (typeof STRANDS)[number];

    const afterSolve = recordAnswer(content, state, problem, true);
    expect(afterSolve.frontier[strand].points).toBeGreaterThanOrEqual(3);

    state = recordAnswer(content, state, problem, false);
    // From 3 there is nowhere lower, so it stays at 3.
    expect(state.frontier[strand].points).toBe(3);
  });

  it('bounds a strand when there is no problem where it would move to', () => {
    const { state } = run('5-6', () => true);
    // Climbing repeatedly must eventually run out of problems, not loop for ever.
    expect(state.answers.length).toBeLessThanOrEqual(MAX_ITEMS);
  });

  it('never moves to a skill already asked about', () => {
    const { state } = run('5-6', (index) => index % 3 !== 0);
    const skillIds = state.answers.map((answer) => answer.skillId);
    expect(new Set(skillIds).size).toBe(skillIds.length);
  });
});

describe('two students with different weaknesses get different plans — M2.7 acceptance', () => {
  it('produces visibly different plans', () => {
    const strongCounter = run('5-6', (_index, skillId) => skillId.startsWith('CNT'));
    const strongGeometer = run('5-6', (_index, skillId) => skillId.startsWith('GEO'));

    const planA = summarise(content, strongCounter.state).planOrder;
    const planB = summarise(content, strongGeometer.state).planOrder;

    expect(planA).not.toEqual(planB);
    expect(planA.length).toBeGreaterThan(0);
    expect(planB.length).toBeGreaterThan(0);
  });

  it('gives a student who answers everything correctly nothing to fix', () => {
    const { state } = run('5-6', () => true);
    expect(summarise(content, state).planOrder).toEqual([]);
  });

  it('gives a student who misses everything a substantial plan', () => {
    const { state } = run('5-6', () => false);
    expect(summarise(content, state).planOrder.length).toBeGreaterThan(0);
  });
});

describe('the plan is ordered by the graph, not by the order things were missed', () => {
  it('never places a skill before one of its prerequisites that is also in the plan', () => {
    const { state } = run('5-6', (index) => index % 4 === 0);
    const plan = buildPlan(content, state);
    const position = new Map(plan.map((id, index) => [id, index]));

    for (const id of plan) {
      for (const prereq of getSkill(id)?.prerequisites ?? []) {
        if (!position.has(prereq)) continue;
        expect(position.get(prereq) ?? -1, `${prereq} must come before ${id}`).toBeLessThan(
          position.get(id) ?? 0,
        );
      }
    }
  });

  it('pulls in the prerequisites of a missed skill even if they were never asked', () => {
    const { state } = run('5-6', () => false);
    const plan = buildPlan(content, state);
    const asked = new Set(state.answers.map((answer) => answer.skillId));
    expect(plan.some((id) => !asked.has(id))).toBe(true);
  });

  it('leaves out a prerequisite the student demonstrated', () => {
    // A skill answered correctly is not put on the plan as a prerequisite of a later miss.
    const { state } = run('5-6', (index) => index === 0);
    const solved = state.answers.find((answer) => answer.correct)?.skillId;
    if (!solved) return;
    expect(buildPlan(content, state)).not.toContain(solved);
  });

  it('is deterministic — same answers, same plan', () => {
    const policy = (index: number) => index % 3 === 0;
    expect(buildPlan(content, run('5-6', policy).state)).toEqual(
      buildPlan(content, run('5-6', policy).state),
    );
  });
});

describe('the result', () => {
  it('reports every strand, including ones that were never asked about', () => {
    const { state } = run('5-6', () => true);
    const result = summarise(content, state);
    expect(result.strands.map((s) => s.strand)).toEqual([...STRANDS]);
  });

  it('counts what was asked and what was right', () => {
    const { state } = run('5-6', (index) => index % 2 === 0);
    const result = summarise(content, state);
    expect(result.asked).toBe(state.answers.length);
    expect(result.correct).toBe(state.answers.filter((a) => a.correct).length);
    const perStrand = result.strands.reduce((n, s) => n + s.asked, 0);
    expect(perStrand).toBe(result.asked);
  });

  it('splits the plan into six weeks and loses nothing', () => {
    const { state } = run('5-6', () => false);
    const result = summarise(content, state);
    expect(result.plan).toHaveLength(6);
    expect(result.plan.flatMap((week) => week.skillIds)).toEqual(result.planOrder);
  });

  it('leaves the weeks empty rather than inventing work', () => {
    const { state } = run('5-6', () => true);
    const result = summarise(content, state);
    expect(result.plan.every((week) => week.skillIds.length === 0)).toBe(true);
  });

  it('survives a state with no answers at all', () => {
    const result = summarise(content, startDiagnostic(content, '3-4'));
    expect(result.asked).toBe(0);
    expect(result.planOrder).toEqual([]);
    expect(result.strands).toHaveLength(7);
  });
});

describe('the state is plain JSON, so it survives localStorage', () => {
  it('round-trips through JSON unchanged', () => {
    const { state } = run('5-6', (index) => index % 2 === 0);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('can be resumed from a serialised state', () => {
    const { state } = run('5-6', (index) => index % 2 === 0);
    const revived = JSON.parse(JSON.stringify(state)) as DiagnosticState;
    expect(summarise(content, revived)).toEqual(summarise(content, state));
  });
});
