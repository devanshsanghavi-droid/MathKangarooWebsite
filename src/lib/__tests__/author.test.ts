import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  draftPath,
  draftToJson,
  emptyDraft,
  nextProblemId,
  openPrUrl,
  validateDraft,
  type ProblemDraft,
} from '../author';
import { getAllProblems, getAllSkills } from '../content';
import { validateContent } from '../../../scripts/lib/content-rules.ts';

const knownSkillIds = getAllSkills().map((s) => s.id);
const usedProblemIds = getAllProblems().map((p) => p.id);
const context = { knownSkillIds, usedProblemIds };

/** A draft that is complete and correct, for tests to break one field of at a time. */
function goodDraft(overrides: Partial<ProblemDraft> = {}): ProblemDraft {
  return {
    ...emptyDraft('KA-9001', '2026-08-28'),
    statement: 'A board is drawn with nine equal squares. How many squares are there in total?',
    choices: [
      { key: 'A', text: '3', misconception: 'I counted the rows and forgot to count the columns.' },
      {
        key: 'B',
        text: '6',
        misconception: 'I added the rows to the columns instead of multiplying.',
      },
      { key: 'C', text: '9', misconception: '' },
      {
        key: 'D',
        text: '12',
        misconception: 'I counted the gridlines rather than the cells between them.',
      },
      {
        key: 'E',
        text: '18',
        misconception: 'I doubled the count because each cell has two diagonals.',
      },
    ],
    correctKey: 'C',
    primarySkill: 'CNT-01',
    secondarySkills: 'CNT-04',
    hint1: 'Count one row, then count the rows.',
    hint2: 'Every row holds the same number of cells, so one multiplication answers it.',
    hint3: 'Three rows of three cells is 3 times 3, which is 9 squares in total.',
    reliable:
      'Count the cells in one row, then multiply by the number of rows: three threes is nine. ' +
      'The transferable idea: a rectangle of cells is one multiplication, never a recount.',
    whyOnTest: 'It fixes the habit of multiplying rather than recounting a grid.',
    estSeconds: '45',
    author: 'Devansh Sanghavi',
    ...overrides,
  };
}

describe('nextProblemId', () => {
  it('suggests the next free id', () => {
    expect(nextProblemId(['KA-0001', 'KA-0007', 'KA-0003'])).toBe('KA-0008');
  });

  it('starts at KA-0001 for an empty bank', () => {
    expect(nextProblemId([])).toBe('KA-0001');
  });

  it('suggests an id nobody is using, against the real bank', () => {
    const suggested = nextProblemId(usedProblemIds);
    expect(usedProblemIds).not.toContain(suggested);
    expect(suggested).toMatch(/^KA-\d{4}$/);
  });
});

describe('draftToJson', () => {
  it('marks exactly the chosen key correct', () => {
    const json = draftToJson(goodDraft()) as { choices: Array<{ key: string; correct: boolean }> };
    expect(json.choices.filter((c) => c.correct).map((c) => c.key)).toEqual(['C']);
  });

  it("nulls the correct choice's misconception, whatever was typed", () => {
    const draft = goodDraft();
    draft.choices[2] = { key: 'C', text: '9', misconception: 'should be discarded' };
    const json = draftToJson(draft) as { choices: Array<{ key: string; misconception: unknown }> };
    expect(json.choices.find((c) => c.key === 'C')?.misconception).toBeNull();
  });

  it('omits the figure entirely when no component is named', () => {
    expect((draftToJson(goodDraft()) as { figure: unknown }).figure).toBeNull();
  });

  it('includes the figure when one is named', () => {
    const json = draftToJson(
      goodDraft({
        figureComponent: 'BoardThreeByThree',
        figureAlt: 'A three by three grid of nine equal squares.',
      }),
    ) as { figure: { component: string; alt: string } | null };
    expect(json.figure?.component).toBe('BoardThreeByThree');
  });

  it('splits secondary skills on commas and trims them', () => {
    const json = draftToJson(goodDraft({ secondarySkills: ' CNT-04 , GEO-02 ' })) as {
      skills: { secondary: string[] };
    };
    expect(json.skills.secondary).toEqual(['CNT-04', 'GEO-02']);
  });

  it('records a new problem as unreviewed rather than claiming a review', () => {
    expect((draftToJson(goodDraft()) as { reviewedBy: string[] }).reviewedBy).toEqual([
      'pending-review',
    ]);
  });

  it('starts calibration empty, because difficulty is measured and never asserted', () => {
    expect((draftToJson(goodDraft()) as { calibration: unknown }).calibration).toEqual({
      pValue: null,
      medianMs: null,
      n: 0,
    });
  });
});

describe('validateDraft catches what CI would', () => {
  it('accepts a complete draft', () => {
    const result = validateDraft(goodDraft(), context);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.problem).not.toBeNull();
  });

  it('rejects a wrong choice with no misconception', () => {
    const draft = goodDraft();
    draft.choices[0] = { key: 'A', text: '3', misconception: '' };
    const result = validateDraft(draft, context);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.startsWith('choices'))).toBe(true);
  });

  it('rejects a misconception that is too short to say anything', () => {
    const draft = goodDraft();
    draft.choices[0] = { key: 'A', text: '3', misconception: 'I guessed.' };
    expect(validateDraft(draft, context).ok).toBe(false);
  });

  it('rejects a figure without alt text', () => {
    const result = validateDraft(goodDraft({ figureComponent: 'BoardThreeByThree' }), context);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.startsWith('figure'))).toBe(true);
  });

  it('rejects a duplicate problem id', () => {
    const result = validateDraft(goodDraft({ id: usedProblemIds[0] ?? 'KA-0001' }), context);
    expect(result.issues.some((i) => i.path === 'id' && /already used/.test(i.message))).toBe(true);
  });

  it('rejects a skill that is not in the Atlas', () => {
    const result = validateDraft(goodDraft({ primarySkill: 'ZZZ-99' }), context);
    expect(result.issues.some((i) => i.path === 'skills.primary')).toBe(true);
  });

  it('rejects a secondary skill that repeats the primary', () => {
    const result = validateDraft(goodDraft({ secondarySkills: 'CNT-01' }), context);
    expect(result.issues.some((i) => /already the primary/.test(i.message))).toBe(true);
  });

  it('rejects a statement that is too short', () => {
    expect(validateDraft(goodDraft({ statement: 'Too short.' }), context).ok).toBe(false);
  });

  it('rejects a reliable solution that is too short', () => {
    expect(validateDraft(goodDraft({ reliable: 'Count them.' }), context).ok).toBe(false);
  });

  it('rejects an estSeconds outside the allowed range', () => {
    expect(validateDraft(goodDraft({ estSeconds: '5' }), context).ok).toBe(false);
    expect(validateDraft(goodDraft({ estSeconds: '9999' }), context).ok).toBe(false);
  });

  it('rejects an empty draft with a list of things to fix rather than crashing', () => {
    const result = validateDraft(emptyDraft('KA-9001', '2026-08-28'), context);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(3);
  });
});

describe('a problem authored through the form passes the real validator — M2.13 acceptance', () => {
  it('writes a file that scripts/validate-content.ts accepts unmodified', () => {
    const draft = goodDraft();
    const result = validateDraft(draft, context);
    expect(result.ok).toBe(true);

    // Build a miniature content tree containing only the skills this draft references, plus
    // the file the form produced, and run the actual validator over it.
    const root = mkdtempSync(join(tmpdir(), 'ka-author-'));
    try {
      for (const id of ['CNT-01', 'CNT-04']) {
        const skill = getAllSkills().find((s) => s.id === id);
        if (!skill) throw new Error(`${id} is missing`);
        const dir = join(root, 'content', 'skills', skill.strand);
        mkdirSync(dir, { recursive: true });
        // unlocks must be the exact reverse of prerequisites within this subset, so blank both.
        writeFileSync(
          join(dir, `${skill.id}.json`),
          JSON.stringify(
            { ...skill, prerequisites: [], unlocks: [], canonicalProblem: null },
            null,
            2,
          ),
        );
      }
      const problemDir = join(root, 'content', 'problems', draft.band);
      mkdirSync(problemDir, { recursive: true });
      writeFileSync(join(problemDir, `${draft.id}.json`), result.json);

      const { findings } = validateContent({ contentDir: join(root, 'content') });
      expect(findings.map((f) => `${f.rule}: ${f.message}`)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the pull request link', () => {
  it('names the file at the path the validator expects', () => {
    const draft = goodDraft({ band: '5-6', id: 'KA-9002' });
    expect(draftPath(draft)).toBe('content/problems/5-6/KA-9002.json');
  });

  it("opens GitHub's new-file editor with the content prefilled", () => {
    const draft = goodDraft();
    const { json } = validateDraft(draft, context);
    const url = new URL(openPrUrl('https://github.com/owner/repo', draft, json));
    expect(url.pathname).toBe('/owner/repo/new/main');
    expect(url.searchParams.get('filename')).toBe(draftPath(draft));
    expect(url.searchParams.get('value')).toBe(json);
  });

  it('stays inside a URL length a browser and GitHub will accept', () => {
    const draft = goodDraft();
    const { json } = validateDraft(draft, context);
    expect(openPrUrl('https://github.com/owner/repo', draft, json).length).toBeLessThan(8000);
  });
});

describe('the form and CI apply the same rules — they cannot drift', () => {
  it('rejects a short misconception in both places, with the same message', async () => {
    const { checkProblemRules } = await import('../problem-rules');
    const draft = goodDraft();
    draft.choices[0] = { key: 'A', text: '3', misconception: 'I guessed.' };
    const formIssues = validateDraft(draft, context).issues;
    const ruleViolations = checkProblemRules(draftToJson(draft));

    expect(ruleViolations).toHaveLength(1);
    expect(formIssues.some((issue) => issue.message === ruleViolations[0]?.message)).toBe(true);
  });

  it('uses the shared rules rather than a copy of them', async () => {
    const { readFileSync } = await import('node:fs');
    const validator = readFileSync(
      join(process.cwd(), 'scripts', 'lib', 'content-rules.ts'),
      'utf8',
    );
    const author = readFileSync(join(process.cwd(), 'src', 'lib', 'author.ts'), 'utf8');
    expect(validator).toMatch(/checkProblemRules/);
    expect(author).toMatch(/checkProblemRules/);
  });
});
