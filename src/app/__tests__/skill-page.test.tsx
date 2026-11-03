import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, within, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SkillPage, { generateStaticParams, generateMetadata } from '../skill/[id]/page';
import SkillLearnPage from '../skill/[id]/learn/page';
import LadderPage, {
  generateStaticParams as ladderParams,
} from '../skill/[id]/practice/[tier]/page';
import SkillQuizPage from '../skill/[id]/quiz/page';
import type * as contentModule from '@/lib/content';
import { getAllSkills, getSkill, getProblemsForSkill } from '@/lib/content';
import { resetProgressCache } from '@/components/mastery/useProgress';

type ContentModule = typeof contentModule;

/**
 * docs/05-DESIGN-DIRECTION.md §7.2 replaced the nine stacked sections with a unit page.
 * Nothing was deleted - the reading moved to /skill/[id]/learn and the problems moved into
 * the ladders - so these tests follow the content to where it went rather than dropping the
 * assertions that used to guard it.
 */

/** The unit page's own sections. */
const UNIT_SECTIONS = ['unit-progress', 'unit-lessons', 'unit-graph', 'unit-papers'] as const;

/** The four reading sections that moved to /learn, plus the full problem list. */
const LEARN_SECTIONS = [
  'definition',
  'recognise',
  'example',
  'misconceptions',
  'every-problem',
] as const;

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
});

async function renderSkill(id: string) {
  return render(await SkillPage({ params: Promise.resolve({ id }) }));
}

async function renderLearn(id: string) {
  return render(await SkillLearnPage({ params: Promise.resolve({ id }) }));
}

describe('generateStaticParams', () => {
  it('emits one unit page per skill', () => {
    expect(generateStaticParams()).toHaveLength(91);
  });

  it('emits one ladder page per skill per point tier', () => {
    expect(ladderParams()).toHaveLength(91 * 3);
    expect(
      ladderParams()
        .filter((p) => p.id === 'CNT-12')
        .map((p) => p.tier),
    ).toEqual(['3', '4', '5']);
  });
});

describe('generateMetadata', () => {
  it('gives every skill a real title and description', async () => {
    for (const skill of getAllSkills()) {
      const meta = await generateMetadata({ params: Promise.resolve({ id: skill.id }) });
      expect(meta.title, skill.id).toBe(`${skill.name} (${skill.id})`);
      expect(meta.description, skill.id).toBe(skill.definition);
    }
  });

  it('refuses to index an unknown id', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'ZZZ-99' }) });
    expect(meta.robots).toEqual({ index: false });
  });
});

describe('every one of the 91 skills renders as a unit page', () => {
  it.each(getAllSkills().map((s) => [s.id] as const))('%s', async (id) => {
    const { container, unmount } = await renderSkill(id);

    expect(container.querySelector('h1')?.textContent, id).toBe(getSkill(id)?.name);
    for (const section of UNIT_SECTIONS) {
      const node = container.querySelector(`#${section}`);
      expect(node, `${id} is missing #${section}`).not.toBeNull();
      expect(node?.textContent?.trim().length, `${id} #${section} is empty`).toBeGreaterThan(10);
    }

    // The five lesson rows: Learn, three ladders, the quiz.
    const lessons = container.querySelector('#unit-lessons');
    expect(lessons?.querySelectorAll('li'), id).toHaveLength(5);

    expect(container.textContent).not.toMatch(/TODO|TBD|coming soon|lorem ipsum/i);
    unmount();
  });
});

describe('the unit page', () => {
  const id = 'CNT-12';

  it('breadcrumbs strand, band and skill (docs/05 §7.2)', async () => {
    const { container } = await renderSkill(id);
    const crumb = container.querySelector('nav[aria-label="Breadcrumb"]')?.textContent ?? '';
    expect(crumb).toContain('Counting');
    expect(crumb).toContain(id);
    // The band segment: "5–6" style, from the skill's own bands.
    expect(crumb).toMatch(/\d+–\d+/);
  });

  it('shows a difficulty pill built from the neutral ramp, never a feedback colour', async () => {
    const { container } = await renderSkill(id);
    const classes = [...(container.querySelectorAll('header *') ?? [])]
      .map((node) => node.className)
      .join(' ');
    expect(classes).toMatch(/bg-d[123]-bg/);
    expect(classes).not.toMatch(/correct|wrong|hint/);
  });

  it('draws a working mastery bar for a signed-out visitor (docs/05 §9)', async () => {
    const { container } = await renderSkill(id);
    const bar = within(container.querySelector('#unit-progress') as HTMLElement).getByRole('img');
    const total = getProblemsForSkill(id).length;
    expect(bar.getAttribute('aria-label')).toBe(
      `Progress through this skill: 0 of ${total} problems solved cleanly.`,
    );
    expect(bar.querySelectorAll('[data-mastery="unseen"]')).toHaveLength(total);
  });

  it('says plainly that progress is local and needs no account', async () => {
    const { container } = await renderSkill(id);
    expect(container.querySelector('#unit-progress')?.textContent).toMatch(
      /Saved in this browser only\. No account, nothing sent anywhere\./,
    );
  });

  it('links each ladder to its own exercise page', async () => {
    const { container } = await renderSkill(id);
    const lessons = container.querySelector('#unit-lessons') as HTMLElement;
    expect(within(lessons).getByRole('link', { name: /Learn/ })).toHaveAttribute(
      'href',
      `/skill/${id}/learn`,
    );
    for (const points of [3, 4, 5]) {
      const row = within(lessons).queryByRole('link', {
        name: new RegExp(`${points}-point ladder`),
      });
      // A tier with no problems is a locked row, not a link - asserted separately below.
      if (row) expect(row).toHaveAttribute('href', `/skill/${id}/practice/${points}`);
    }
  });

  it('locks the skill quiz until the ladders are finished', async () => {
    const { container } = await renderSkill(id);
    const lessons = container.querySelector('#unit-lessons') as HTMLElement;
    expect(within(lessons).queryByRole('link', { name: /Skill quiz/ })).toBeNull();
    expect(lessons.textContent).toMatch(/Finish the ladders above first/);
  });
});

describe('the learn page - where the reading moved', () => {
  const id = 'CNT-12';

  it('renders all four reading sections and the full problem list', async () => {
    const { container } = await renderLearn(id);
    for (const section of LEARN_SECTIONS) {
      const node = container.querySelector(`#${section}`);
      expect(node, `missing #${section}`).not.toBeNull();
      expect(node?.textContent?.trim().length, `#${section} is empty`).toBeGreaterThan(20);
    }
  });

  it('shows the canonical worked example', async () => {
    const { container } = await renderLearn(id);
    expect(container.querySelector('#example')?.textContent).toContain(
      getSkill(id)?.canonicalProblem ?? 'missing',
    );
  });

  it('groups every problem by point value, in order', async () => {
    const { container } = await renderLearn(id);
    const list = container.querySelector('#every-problem');
    const pills = [...(list?.querySelectorAll('h3') ?? [])].map((h) => h.textContent ?? '');
    expect(pills).toHaveLength(3);
    [3, 4, 5].forEach((points, index) => {
      expect(pills[index], `rung ${index}`).toContain(`${points} pt`);
    });
    for (const problem of getProblemsForSkill(id)) {
      expect(list?.textContent, problem.id).toContain(problem.id);
    }
  });

  it('does not paint the misconceptions list in the reserved red', async () => {
    // docs/05 §2: a list of misconceptions is a CATEGORY, not a response to something the
    // reader just did. v1 gave it the same border as a wrong answer.
    const { container } = await renderLearn(id);
    const classes = [...container.querySelectorAll('#misconceptions *')]
      .map((node) => node.className)
      .join(' ');
    expect(classes).toMatch(/border-rule-strong/);
    expect(classes).not.toMatch(/correct|wrong|hint/);
  });
});

describe('every skill in the bank now has problems', () => {
  it('leaves no skill with an empty practice ladder', () => {
    const empty = getAllSkills().filter((s) => getProblemsForSkill(s.id).length === 0);
    expect(empty.map((s) => s.id)).toEqual([]);
  });

  it('gives every skill a canonical worked example', () => {
    const missing = getAllSkills().filter((s) => s.canonicalProblem === null);
    expect(missing.map((s) => s.id)).toEqual([]);
  });
});

describe('a skill with no problems - the empty state', () => {
  // No real skill is uncovered any more, which is the point of M1.10. The empty branches still
  // have to work, because a new skill lands with no problems the day it is added.
  async function withEmptySkill<T>(run: (mod: ContentModule) => Promise<T>): Promise<T> {
    vi.resetModules();
    vi.doMock('@/lib/content', async () => {
      const actual = (await vi.importActual('@/lib/content')) as ContentModule;
      const skill = actual.getSkill('GEO-17');
      if (!skill) throw new Error('GEO-17 is missing');
      return {
        ...actual,
        getSkill: (id: string) =>
          id === 'GEO-17' ? { ...skill, canonicalProblem: null } : actual.getSkill(id),
        getProblemsForSkill: (id: string) =>
          id === 'GEO-17' ? [] : actual.getProblemsForSkill(id),
        getPapersForSkill: () => [],
      };
    });
    try {
      return await run((await import('@/lib/content')) as ContentModule);
    } finally {
      vi.doUnmock('@/lib/content');
      vi.resetModules();
    }
  }

  it('locks every ladder and says why, rather than showing empty rungs', async () => {
    await withEmptySkill(async () => {
      const EmptyPage = (await import('../skill/[id]/page')).default;
      const { container } = render(await EmptyPage({ params: Promise.resolve({ id: 'GEO-17' }) }));
      const lessons = container.querySelector('#unit-lessons');
      expect(lessons?.textContent).toMatch(/Nothing written at this tier yet/);
      expect(container.querySelector('#unit-progress')?.textContent).toMatch(
        /No problems in this skill yet/,
      );
    });
  });

  it('says so in a sentence on the learn page too', async () => {
    await withEmptySkill(async () => {
      const EmptyLearn = (await import('../skill/[id]/learn/page')).default;
      const { container } = render(await EmptyLearn({ params: Promise.resolve({ id: 'GEO-17' }) }));
      expect(container.querySelector('#every-problem')?.textContent).toMatch(
        /No problems tagged .* have been written yet/,
      );
      expect(container.querySelector('#example')?.textContent).toMatch(/No worked example/);
    });
  });
});

describe('prerequisites and unlocks', () => {
  it('links every prerequisite and every unlocked skill', async () => {
    const skill = getSkill('CNT-13');
    if (!skill) throw new Error('CNT-13 is missing');
    const { container } = await renderSkill(skill.id);
    const section = container.querySelector('#unit-graph');
    if (!section) throw new Error('#unit-graph is missing');
    for (const related of [...skill.prerequisites, ...skill.unlocks]) {
      expect(
        within(section as HTMLElement).getByRole('link', { name: new RegExp(related) }),
        related,
      ).toHaveAttribute('href', `/skill/${related}`);
    }
  });

  it('tells a root skill it is a root, rather than showing an empty box', async () => {
    const { container } = await renderSkill('NUM-01');
    expect(container.querySelector('#unit-graph')?.textContent).toMatch(/the Atlas starts from/);
  });
});

describe('the official-papers section', () => {
  it('states, in whichever branch renders, that we hold analysis and not problems', async () => {
    // CLAUDE.md, non-negotiable #1. Both the empty and the populated wording must say it, so
    // this assertion has to survive M1.8 filling the section in.
    for (const id of ['CNT-12', 'GEO-10', 'CFT-08']) {
      const { container, unmount } = await renderSkill(id);
      const papers = container.querySelector('#unit-papers')?.textContent ?? '';
      expect(papers, `${id} #unit-papers`).toMatch(/never/i);
      expect(papers, `${id} #unit-papers`).toMatch(/our (own )?(skill tags|analysis)/i);
      unmount();
    }
  });
});

describe('the exercise view', () => {
  async function renderLadder(id: string, tier: string) {
    return render(await LadderPage({ params: Promise.resolve({ id, tier }) }));
  }

  it('serves one problem at a time with its streak target', async () => {
    const { container } = await renderLadder('CNT-12', '3');
    expect(container.textContent).toMatch(/3 in a row to finish this ladder/);
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });

  it('keeps immediate distractor-specific feedback (docs/05 §7.3)', async () => {
    const { container } = await renderLadder('CNT-12', '3');
    const group = within(container).getByRole('group', { name: /answer choices/i });
    const wrong = within(group)
      .getAllByRole('button')
      .find((button) => !button.textContent?.includes('correct'));
    await userEvent.click(wrong as HTMLElement);
    const feedback = await screen.findByTestId('feedback');
    expect(feedback).toBeInTheDocument();
    // Not a generic "incorrect": the misconception recorded for THAT choice.
    expect(feedback.textContent).toMatch(/Here is the thinking that leads there/);
  });

  it('records the first answer in local progress and nowhere else', async () => {
    const { container } = await renderLadder('CNT-12', '3');
    const group = within(container).getByRole('group', { name: /answer choices/i });
    await userEvent.click(within(group).getAllByRole('button')[0] as HTMLElement);
    const stored = window.localStorage.getItem('ka-progress');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? '{}').attempts['CNT-12']).toHaveLength(1);
  });

  it('offers a hint, a skip and a next problem', async () => {
    const { container } = await renderLadder('CNT-12', '3');
    for (const label of [/Show a hint/, /^Skip$/, /Next problem/]) {
      expect(within(container).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('resumes at the first problem the student has not solved', async () => {
    // The problem on screen follows stored progress until the student touches something.
    //
    // Worth knowing what this does and does not prove: the bug it was written for only
    // appears on the hydration path, where useSyncExternalStore hands back the SERVER
    // snapshot and a `useState(startIndex)` initialiser therefore always saw an empty
    // progress file. Testing Library mounts client-side, so it would have passed against the
    // broken version too. It guards the behaviour; the hydration path itself needs a browser.
    const ladder = getProblemsForSkill('CNT-12').filter((p) => p.points === 5);
    const first = ladder[0];
    if (!first || ladder.length < 2) throw new Error('CNT-12 needs two 5-point problems');
    window.localStorage.setItem(
      'ka-progress',
      JSON.stringify({
        version: 1,
        attempts: {
          'CNT-12': [
            {
              problemId: first.id,
              points: 5,
              correct: true,
              hintsUsed: 0,
              at: '2026-03-01T10:00:00.000Z',
            },
          ],
        },
      }),
    );
    resetProgressCache();
    const { container } = await renderLadder('CNT-12', '5');
    expect(container.textContent).toContain(ladder[1]?.id);
    expect(container.querySelector('article')?.textContent).not.toContain(first.id);
  });

  it('does not yank the next problem onto the screen while feedback is being read', async () => {
    const { container } = await renderLadder('CNT-12', '5');
    const shown = container.querySelector('article h2')?.textContent;
    const group = within(container).getByRole('group', { name: /answer choices/i });
    const correct = within(group)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('30'));
    await userEvent.click(correct ?? (within(group).getAllByRole('button')[0] as HTMLElement));
    expect(container.querySelector('article h2')?.textContent).toBe(shown);
  });

  it('404s on a tier that is not 3, 4 or 5', async () => {
    await expect(renderLadder('CNT-12', '7')).rejects.toThrow();
  });
});

describe('the skill quiz', () => {
  it('asks five problems and marks nothing until the end', async () => {
    const { container } = render(
      await SkillQuizPage({ params: Promise.resolve({ id: 'CNT-12' }) }),
    );
    expect(container.querySelectorAll('article').length).toBeLessThanOrEqual(5);
    expect(container.textContent).toMatch(/Nothing is marked until you finish/);
    expect(screen.queryByTestId('feedback')).toBeNull();
  });

  it('shows every explanation once finished', async () => {
    render(await SkillQuizPage({ params: Promise.resolve({ id: 'CNT-12' }) }));
    const groups = screen.getAllByRole('group', { name: /answer choices/i });
    for (const group of groups) {
      await userEvent.click(within(group).getAllByRole('button')[0] as HTMLElement);
    }
    await userEvent.click(screen.getByRole('button', { name: /Finish and see the explanations/ }));
    expect(screen.getAllByTestId('feedback').length).toBe(groups.length);
  });
});

describe('accessibility structure', () => {
  it('has exactly one h1 and gives every section a heading', async () => {
    const { container } = await renderSkill('GEO-10');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    for (const section of UNIT_SECTIONS) {
      const node = container.querySelector(`#${section}`);
      expect(node?.getAttribute('aria-labelledby'), section).toBe(`${section}-heading`);
      expect(container.querySelector(`#${section}-heading`), section).not.toBeNull();
    }
  });

  it.each([
    ['unit', (id: string) => renderSkill(id)],
    ['learn', (id: string) => renderLearn(id)],
  ])('does not skip a heading level on the %s page', async (_name, renderPage) => {
    const { container } = await renderPage('CNT-12');
    const levels = [...container.querySelectorAll('h1,h2,h3,h4')].map((h) =>
      Number(h.tagName.slice(1)),
    );
    let previous = 0;
    for (const level of levels) {
      expect(level, `jumped from h${previous} to h${level}`).toBeLessThanOrEqual(previous + 1);
      previous = level;
    }
  });
});

describe('unknown skill', () => {
  it.each([
    ['unit', (id: string) => SkillPage({ params: Promise.resolve({ id }) })],
    ['learn', (id: string) => SkillLearnPage({ params: Promise.resolve({ id }) })],
    ['quiz', (id: string) => SkillQuizPage({ params: Promise.resolve({ id }) })],
  ])('is a 404 rather than a broken %s page', async (_name, load) => {
    await expect(load('ZZZ-99')).rejects.toThrow();
  });
});
