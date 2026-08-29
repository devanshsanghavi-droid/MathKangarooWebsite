import { ProblemSchema, type Band, type ChoiceKey, type Points, type Problem } from './schemas';
import { checkProblemRules } from './problem-rules';

/**
 * The authoring form's draft type and the conversion into a real problem.
 *
 * A draft is all-strings, because that is what form controls hold. `toProblem` is the one place
 * strings become the typed thing, and it deliberately runs the SAME `ProblemSchema` that
 * `pnpm validate:content` runs - so a draft the form calls valid is a file CI will accept
 * unmodified. That is M2.13's acceptance criterion, and sharing the schema is the only way to
 * mean it.
 */

export const CHOICE_KEYS: readonly ChoiceKey[] = ['A', 'B', 'C', 'D', 'E'];

export interface ChoiceDraft {
  key: ChoiceKey;
  text: string;
  misconception: string;
}

export interface ProblemDraft {
  id: string;
  band: Band;
  points: Points;
  statement: string;
  figureComponent: string;
  figureAlt: string;
  choices: ChoiceDraft[];
  correctKey: ChoiceKey;
  primarySkill: string;
  secondarySkills: string;
  hint1: string;
  hint2: string;
  hint3: string;
  reliable: string;
  elegant: string;
  whyOnTest: string;
  estSeconds: string;
  author: string;
  createdAt: string;
}

export function emptyDraft(nextId: string, today: string): ProblemDraft {
  return {
    id: nextId,
    band: '3-4',
    points: 3,
    statement: '',
    figureComponent: '',
    figureAlt: '',
    choices: CHOICE_KEYS.map((key) => ({ key, text: '', misconception: '' })),
    correctKey: 'A',
    primarySkill: '',
    secondarySkills: '',
    hint1: '',
    hint2: '',
    hint3: '',
    reliable: '',
    elegant: '',
    whyOnTest: '',
    estSeconds: '60',
    author: '',
    createdAt: today,
  };
}

/** The JSON shape, before validation. Unknown-typed on purpose: it may not be valid yet. */
export function draftToJson(draft: ProblemDraft): unknown {
  const secondary = draft.secondarySkills
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    id: draft.id.trim(),
    band: draft.band,
    points: draft.points,
    statement: draft.statement.trim(),
    figure: draft.figureComponent.trim()
      ? { component: draft.figureComponent.trim(), alt: draft.figureAlt.trim() }
      : null,
    choices: draft.choices.map((choice) => ({
      key: choice.key,
      text: choice.text.trim(),
      correct: choice.key === draft.correctKey,
      // The biconditional the schema enforces: a misconception exactly when the choice is wrong.
      misconception: choice.key === draft.correctKey ? null : choice.misconception.trim() || null,
    })),
    skills: { primary: draft.primarySkill.trim(), secondary },
    hints: [draft.hint1.trim(), draft.hint2.trim(), draft.hint3.trim()],
    solutions: {
      reliable: draft.reliable.trim(),
      elegant: draft.elegant.trim() || null,
    },
    whyOnTest: draft.whyOnTest.trim(),
    estSeconds: Number(draft.estSeconds),
    calibration: { pValue: null, medianMs: null, n: 0 },
    author: draft.author.trim(),
    // A new problem has not been reviewed by anyone yet, and saying so is the honest default.
    reviewedBy: ['pending-review'],
    createdAt: draft.createdAt,
    license: 'CC-BY-NC-SA-4.0',
  };
}

export interface DraftIssue {
  /** Dotted path into the JSON, e.g. "choices.2.misconception". Empty string for whole-file. */
  path: string;
  message: string;
}

export interface DraftValidation {
  ok: boolean;
  problem: Problem | null;
  issues: DraftIssue[];
  json: string;
}

/**
 * Validate a draft the way CI will.
 *
 * The Zod schema covers the single-file rules. The extra checks here are the cross-file ones
 * that `scripts/validate-content.ts` applies over the whole corpus and that a form can also
 * answer, given the ids it was handed: a duplicate problem id, and a skill that is not in the
 * Atlas. A problem that passes both is one CI will accept without a single edit.
 */
export function validateDraft(
  draft: ProblemDraft,
  context: { knownSkillIds: readonly string[]; usedProblemIds: readonly string[] },
): DraftValidation {
  const value = draftToJson(draft);
  const json = `${JSON.stringify(value, null, 2)}\n`;
  const issues: DraftIssue[] = [];

  // The product rules first, so their message is the one the author reads. These are the same
  // functions scripts/validate-content.ts runs, not a copy of them.
  for (const violation of checkProblemRules(value)) {
    issues.push({ path: violation.path, message: violation.message });
  }

  const parsed = ProblemSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      // Do not repeat a field the product rules already explained better.
      if (issues.some((existing) => existing.path === path)) continue;
      issues.push({ path, message: issue.message });
    }
  }

  const id = draft.id.trim();
  if (context.usedProblemIds.includes(id)) {
    issues.push({ path: 'id', message: `${id} is already used by another problem.` });
  }

  const primary = draft.primarySkill.trim();
  if (primary && !context.knownSkillIds.includes(primary)) {
    issues.push({ path: 'skills.primary', message: `${primary} is not a skill in the Atlas.` });
  }
  for (const skill of draft.secondarySkills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!context.knownSkillIds.includes(skill)) {
      issues.push({ path: 'skills.secondary', message: `${skill} is not a skill in the Atlas.` });
    }
    if (skill === primary) {
      issues.push({
        path: 'skills.secondary',
        message: `${skill} is already the primary skill.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    problem: parsed.success && issues.length === 0 ? parsed.data : null,
    issues: prioritise(issues),
    json,
  };
}

/**
 * Order the issues so the blocking ones come first.
 *
 * A duplicate id or an unknown skill stops the file being usable at all, while a short
 * statement is a five-second fix. The summary panel shows a limited number, and it emerged in
 * testing that a duplicate id could be pushed off the end by eight empty-field messages -
 * hiding the one thing the author most needed to see.
 */
const ISSUE_PRIORITY = ['id', 'skills.primary', 'skills.secondary'];

function prioritise(issues: DraftIssue[]): DraftIssue[] {
  const rank = (issue: DraftIssue) => {
    const index = ISSUE_PRIORITY.indexOf(issue.path);
    return index === -1 ? ISSUE_PRIORITY.length : index;
  };
  return [...issues].sort((a, b) => rank(a) - rank(b));
}

/** Where the file has to live for `pnpm validate:content` to accept it. */
export function draftPath(draft: ProblemDraft): string {
  return `content/problems/${draft.band}/${draft.id.trim()}.json`;
}

/**
 * A GitHub "create a new file" URL with the content already filled in.
 *
 * This is the whole submission flow, and it needs no backend and no write access: the author
 * lands on GitHub's editor with the file named and populated, and commits it as a pull request
 * from their own account. Content still arrives through git and through review, exactly as
 * `docs/00-SPEC.md` §5.1 requires - no direct database writes anywhere.
 */
export function openPrUrl(repo: string, draft: ProblemDraft, json: string): string {
  const params = new URLSearchParams({ filename: draftPath(draft), value: json });
  return `${repo}/new/main?${params.toString()}`;
}

export function nextProblemId(usedIds: readonly string[]): string {
  const numbers = usedIds
    .map((id) => Number(/^KA-(\d{4})$/.exec(id)?.[1] ?? Number.NaN))
    .filter((n) => Number.isInteger(n));
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `KA-${String(next).padStart(4, '0')}`;
}
