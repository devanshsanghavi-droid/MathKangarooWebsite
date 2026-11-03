import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { validateContent } from '../lib/content-rules.ts';
import { CHOICE_KEYS } from '../../src/lib/schemas.ts';

/**
 * The authoring rules in docs/03-CONTENT-GUIDE.md Part B that are numeric enough to check.
 *
 * These are separate from the five CI guardrails in content-rules.ts: a guardrail protects the
 * product or the project's legal position, while these protect the writing. Both fail the
 * build, but a failure here means "rewrite the problem", not "you broke something".
 */

const { bundle } = validateContent({
  contentDir: join(process.cwd(), 'content'),
  figuresDir: join(process.cwd(), 'src', 'components', 'figures'),
});

const problems = [...bundle.problems.values()].sort((a, b) => a.id.localeCompare(b.id));
const words = (s: string) => s.trim().split(/\s+/).length;

/** B2: bands 1–4 under 35 words, bands 5–12 under 60. */
const STATEMENT_CAP: Record<string, number> = {
  '1-2': 35,
  '3-4': 35,
  '5-6': 60,
  '7-8': 60,
  '9-10': 60,
  '11-12': 60,
};

describe('problem statements', () => {
  it('the bank is not empty', () => {
    expect(problems.length).toBeGreaterThan(0);
  });

  it.each(problems.map((p) => [p.id, p] as const))(
    '%s keeps its statement inside the word cap for its band',
    (_id, problem) => {
      expect(words(problem.statement)).toBeLessThanOrEqual(STATEMENT_CAP[problem.band] ?? 60);
    },
  );
});

describe('the hint ladder', () => {
  it.each(problems.map((p) => [p.id, p] as const))(
    '%s has three strictly graduated hints',
    (_id, problem) => {
      const [nudge, strategy, full] = problem.hints;
      // B4: nudge ≤ 15 words, strategy ≤ 40 words, full solution is complete.
      expect(words(nudge), 'nudge must be at most 15 words').toBeLessThanOrEqual(15);
      expect(words(strategy), 'strategy must be at most 40 words').toBeLessThanOrEqual(40);
      expect(nudge.length, 'the nudge must be the shortest rung').toBeLessThan(strategy.length);
      expect(full.length).toBeGreaterThanOrEqual(20);
    },
  );

  it.each(problems.map((p) => [p.id, p] as const))(
    '%s has a nudge that gives nothing away',
    (_id, problem) => {
      // B4: "points attention, gives nothing away". The strongest mechanical version of that
      // is that hint 1 must not contain the correct answer.
      const answer = problem.choices.find((c) => c.correct)?.text.trim() ?? '';
      if (!answer || answer.length > 24) return;
      const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(problem.hints[0], `nudge leaks the answer "${answer}"`).not.toMatch(
        new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i'),
      );
    },
  );
});

describe('solutions', () => {
  it.each(problems.map((p) => [p.id, p] as const))(
    '%s ends the reliable solution by naming a transferable idea, or says plainly there is none',
    (_id, problem) => {
      // B5: every solution ends with one line naming the transferable idea.
      expect(problem.solutions.reliable.length).toBeGreaterThanOrEqual(50);
      expect(problem.solutions.reliable.toLowerCase()).toContain('idea');
    },
  );

  it('does not pretend every problem has an elegant route', () => {
    // B5 says to state plainly when there is no elegant solution. If every single problem had
    // one, the field would have stopped meaning anything.
    const withElegant = problems.filter((p) => p.solutions.elegant !== null);
    expect(withElegant.length).toBeLessThan(problems.length);
    expect(withElegant.length).toBeGreaterThan(0);
  });
});

describe('distractors', () => {
  it.each(problems.map((p) => [p.id, p] as const))(
    '%s gives every wrong choice a distinct misconception',
    (_id, problem) => {
      const wrong = problem.choices.filter((c) => !c.correct);
      expect(wrong).toHaveLength(4);
      const texts = wrong.map((c) => c.misconception?.trim().toLowerCase());
      expect(new Set(texts).size, 'two distractors share a misconception').toBe(4);
      for (const choice of wrong) {
        // "in the student's own voice" - first person, not "students often think".
        expect(choice.misconception, `${problem.id} ${choice.key}`).toMatch(/^I\b/);
      }
    },
  );

  it.each(problems.map((p) => [p.id, p] as const))(
    '%s has five distinct answer texts',
    (_id, problem) => {
      const texts = problem.choices.map((c) => c.text.trim().toLowerCase());
      expect(new Set(texts).size).toBe(5);
    },
  );

  it('does not make the answer guessable from its position', () => {
    // B3: the correct answer must not be predictable. Across the bank, every key must be used,
    // and no key may carry more than half the answers.
    const counts = new Map<string, number>(CHOICE_KEYS.map((k) => [k, 0]));
    for (const problem of problems) {
      const key = problem.choices.find((c) => c.correct)?.key;
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const key of CHOICE_KEYS) {
      expect(counts.get(key), `key ${key} is never the answer`).toBeGreaterThan(0);
      expect(counts.get(key) ?? 0, `key ${key} carries too many answers`).toBeLessThanOrEqual(
        problems.length / 2,
      );
    }
  });
});

describe('coverage', () => {
  it('spreads the bank across all seven strands', () => {
    const strands = new Set(problems.map((p) => p.skills.primary.slice(0, 3)));
    expect(strands.size).toBe(7);
  });

  it('uses all three point tiers in every band it covers', () => {
    const bands = new Set(problems.map((p) => p.band));
    for (const band of bands) {
      const tiers = new Set(problems.filter((p) => p.band === band).map((p) => p.points));
      expect(tiers, `band ${band}`).toEqual(new Set([3, 4, 5]));
    }
  });

  it('points every skill that claims a canonical problem at a problem that teaches it', () => {
    for (const skill of bundle.skills.values()) {
      if (!skill.canonicalProblem) continue;
      const problem = bundle.problems.get(skill.canonicalProblem);
      expect(problem, `${skill.id} -> ${skill.canonicalProblem}`).toBeDefined();
      const tagged = [problem?.skills.primary, ...(problem?.skills.secondary ?? [])];
      expect(tagged, `${skill.id}'s canonical problem does not tag it`).toContain(skill.id);
    }
  });
});
