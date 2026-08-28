import { describe, it, expect } from 'vitest';
import { render, within } from '@testing-library/react';
import SkillPage, { generateStaticParams, generateMetadata } from '../skill/[id]/page';
import { getAllSkills, getSkill, getProblemsForSkill } from '@/lib/content';

/** docs/00-SPEC.md §1.4 — the nine sections, in order. */
const SECTIONS = [
  'definition',
  'recognise',
  'example',
  'misconceptions',
  'prerequisites',
  'practice',
  'papers',
  'drill',
] as const;

async function renderSkill(id: string) {
  const ui = await SkillPage({ params: Promise.resolve({ id }) });
  return render(ui);
}

describe('generateStaticParams', () => {
  it('emits one page per skill', () => {
    expect(generateStaticParams()).toHaveLength(91);
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

describe('every one of the 91 skills renders all nine sections', () => {
  it.each(getAllSkills().map((s) => [s.id] as const))('%s', async (id) => {
    const { container, unmount } = await renderSkill(id);

    // Section 1 is the header itself; the other eight are landmarked <section>s.
    expect(container.querySelector('h1')?.textContent, id).toBe(getSkill(id)?.name);
    for (const section of SECTIONS) {
      expect(container.querySelector(`#${section}`), `${id} is missing #${section}`).not.toBeNull();
    }

    // "or explicitly marks them absent" — no section may be silently blank.
    for (const section of SECTIONS) {
      const node = container.querySelector(`#${section}`);
      expect(node?.textContent?.trim().length, `${id} #${section} is empty`).toBeGreaterThan(20);
    }

    // And no placeholder ever ships.
    expect(container.textContent).not.toMatch(/TODO|TBD|coming soon|lorem ipsum/i);
    unmount();
  });
});

describe('a skill with problems', () => {
  const id = 'CNT-12';

  it('shows the canonical worked example', async () => {
    const { container } = await renderSkill(id);
    const example = container.querySelector('#example');
    expect(example?.textContent).toContain(getSkill(id)?.canonicalProblem ?? 'missing');
  });

  it('groups the practice ladder by point value, in order', async () => {
    const { container } = await renderSkill(id);
    const practice = container.querySelector('#practice');
    const pills = [...(practice?.querySelectorAll('h3') ?? [])].map((h) =>
      h.textContent?.trim().slice(0, 4),
    );
    expect(pills).toEqual(['3 pt', '4 pt', '5 pt']);
  });

  it('lists every problem tagged with the skill', async () => {
    const { container } = await renderSkill(id);
    const practice = container.querySelector('#practice');
    for (const problem of getProblemsForSkill(id)) {
      expect(practice?.textContent, problem.id).toContain(problem.id);
    }
  });

  it('offers a starting point for a drill', async () => {
    const { container } = await renderSkill(id);
    expect(container.querySelector('#drill')?.textContent).toMatch(/Start with KA-/);
  });
});

describe('a skill with no problems', () => {
  const empty = getAllSkills().find((s) => getProblemsForSkill(s.id).length === 0);

  it('exists in the taxonomy, so this case is real', () => {
    expect(empty).toBeDefined();
  });

  it('says so in a sentence rather than showing a blank ladder', async () => {
    if (!empty) return;
    const { container } = await renderSkill(empty.id);
    expect(container.querySelector('#practice')?.textContent).toMatch(
      /No problems tagged .* have been written yet/,
    );
    expect(container.querySelector('#example')?.textContent).toMatch(/No worked example/);
    expect(container.querySelector('#drill')?.textContent).toMatch(/A drill needs problems/);
  });
});

describe('prerequisites and unlocks', () => {
  it('links every prerequisite and every unlocked skill', async () => {
    const skill = getSkill('CNT-13');
    if (!skill) throw new Error('CNT-13 is missing');
    const { container } = await renderSkill(skill.id);
    const section = container.querySelector('#prerequisites');
    if (!section) throw new Error('#prerequisites is missing');
    for (const related of [...skill.prerequisites, ...skill.unlocks]) {
      expect(
        within(section as HTMLElement).getByRole('link', { name: new RegExp(related) }),
        related,
      ).toHaveAttribute('href', `/skill/${related}`);
    }
  });

  it('tells a root skill it is a root, rather than showing an empty box', async () => {
    const { container } = await renderSkill('NUM-01');
    expect(container.querySelector('#prerequisites')?.textContent).toMatch(/the Atlas starts from/);
  });
});

describe('the official-papers section', () => {
  it('states, in whichever branch renders, that we hold analysis and not problems', async () => {
    // CLAUDE.md, non-negotiable #1. Both the empty and the populated wording must say it, so
    // this assertion has to survive M1.8 filling the section in.
    for (const id of ['CNT-12', 'GEO-10', 'CFT-08']) {
      const { container, unmount } = await renderSkill(id);
      const papers = container.querySelector('#papers')?.textContent ?? '';
      expect(papers, `${id} #papers`).toMatch(/never/i);
      expect(papers, `${id} #papers`).toMatch(/our (own )?(skill tags|analysis)/i);
      unmount();
    }
  });
});

describe('accessibility structure', () => {
  it('has exactly one h1 and gives every section a heading', async () => {
    const { container } = await renderSkill('GEO-10');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    for (const section of SECTIONS) {
      const node = container.querySelector(`#${section}`);
      expect(node?.getAttribute('aria-labelledby')).toBe(`${section}-heading`);
      expect(container.querySelector(`#${section}-heading`), section).not.toBeNull();
    }
  });

  it('does not skip a heading level', async () => {
    const { container } = await renderSkill('CNT-12');
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
  it('is a 404 rather than a broken page', async () => {
    await expect(renderSkill('ZZZ-99')).rejects.toThrow();
  });
});
