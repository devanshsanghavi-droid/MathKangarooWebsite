import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AtlasPage from '../atlas/page';
import StrandPage, { generateStaticParams as strandParams } from '../atlas/[strand]/page';
import { getAllSkills, getProblemsForSkill, getSkillsByStrand } from '@/lib/content';
import { STRANDS, type Strand } from '@/lib/schemas';
import type { RawSearchParams } from '@/lib/atlas-params';

async function renderAtlas(searchParams: RawSearchParams = {}) {
  return render(await AtlasPage({ searchParams: Promise.resolve(searchParams) }));
}

/** Every skill id that appears as a link target in the rendered markup. */
function skillIdsIn(container: HTMLElement): string[] {
  const ids = new Set<string>();
  for (const link of container.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') ?? '';
    const direct = /^\/skill\/([A-Z]{3}-\d{2})/.exec(href);
    if (direct?.[1]) ids.add(direct[1]);
    const focused = /[?&]focus=([A-Z]{3}-\d{2})/.exec(href);
    if (focused?.[1]) ids.add(focused[1]);
  }
  return [...ids].sort();
}

const allIds = getAllSkills()
  .map((s) => s.id)
  .sort();

describe('graph and list parity - M1.6 acceptance', () => {
  it('the graph reaches every skill', async () => {
    const { container } = await renderAtlas({});
    expect(skillIdsIn(container)).toEqual(allIds);
  });

  it('the list reaches every skill', async () => {
    const { container } = await renderAtlas({ view: 'list' });
    expect(skillIdsIn(container)).toEqual(allIds);
  });

  it('the two views show identical sets under every filter', async () => {
    const filters: RawSearchParams[] = [
      {},
      { strand: 'CNT' },
      { strand: ['CNT', 'GEO'] },
      { band: '5-6' },
      { has: 'problems' },
      { points: '5' },
      { strand: 'NUM', band: '3-4', has: 'problems' },
    ];
    for (const filter of filters) {
      const graph = await renderAtlas({ ...filter });
      const graphIds = skillIdsIn(graph.container);
      graph.unmount();

      const list = await renderAtlas({ ...filter, view: 'list' });
      const listIds = skillIdsIn(list.container);
      list.unmount();

      expect(listIds, JSON.stringify(filter)).toEqual(graphIds);
    }
  });
});

describe('keyboard reachability - M1.6 acceptance', () => {
  it('makes every skill in the graph a real link, not a click handler', async () => {
    const { container } = await renderAtlas({});
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const anchors = [...(svg?.querySelectorAll('a[href]') ?? [])];
    expect(anchors).toHaveLength(getAllSkills().length);
    // A focusable element with no accessible name is unusable with a screen reader.
    for (const anchor of anchors) {
      expect(anchor.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('names each graph node with its skill name, tier and problem count', async () => {
    const { container } = await renderAtlas({});
    const svg = container.querySelector('svg');
    const label = svg?.querySelector('a[href*="CNT-12"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Counting by position');
    expect(label).toContain('Core');
    expect(label).toMatch(/\d+ problems?/);
  });

  it('offers the view toggle before the diagram in the DOM order', async () => {
    const { container } = await renderAtlas({});
    const html = container.innerHTML;
    expect(html.indexOf('Atlas view')).toBeLessThan(html.indexOf('<svg'));
  });
});

describe('filters', () => {
  it('filters to one strand', async () => {
    const { container } = await renderAtlas({ strand: 'PAT', view: 'list' });
    const ids = skillIdsIn(container);
    expect(ids.length).toBe(getSkillsByStrand('PAT').length);
    expect(ids.every((id) => id.startsWith('PAT'))).toBe(true);
  });

  it('filters to a band', async () => {
    const { container } = await renderAtlas({ band: '1-2', view: 'list' });
    const ids = skillIdsIn(container);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(getAllSkills().find((s) => s.id === id)?.bands, id).toContain('1-2');
    }
  });

  it('filters to skills that have problems', async () => {
    const { container } = await renderAtlas({ has: 'problems', view: 'list' });
    for (const id of skillIdsIn(container)) {
      expect(getProblemsForSkill(id).length, id).toBeGreaterThan(0);
    }
  });

  it('filters to skills with a problem at a point tier', async () => {
    const { container } = await renderAtlas({ points: '5', view: 'list' });
    const ids = skillIdsIn(container);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(
        getProblemsForSkill(id).some((p) => p.points === 5),
        id,
      ).toBe(true);
    }
  });

  it('says how many skills are showing', async () => {
    await renderAtlas({ strand: 'PAT' });
    expect(screen.getByText(String(getSkillsByStrand('PAT').length))).toBeInTheDocument();
  });

  it('shows a written empty state, not a blank canvas, when nothing matches', async () => {
    // Find a combination that really is empty rather than asserting one from memory: the bank
    // grows, and a hard-coded "impossible" filter would quietly stop testing anything.
    const empty = STRANDS.flatMap((strand) =>
      (['1-2', '11-12'] as const).map((band) => ({ strand, band })),
    ).find(({ strand, band }) =>
      getSkillsByStrand(strand)
        .filter((skill) => skill.bands.includes(band))
        .every((skill) => getProblemsForSkill(skill.id).every((p) => p.points !== 5)),
    );
    expect(empty, 'no empty filter combination exists to test with').toBeDefined();
    if (!empty) return;

    const { container } = await renderAtlas({
      strand: empty.strand,
      band: empty.band,
      points: '5',
    });
    expect(container.textContent).toMatch(/No skill matches these filters/);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('offers a way back from every filtered state', async () => {
    const { container } = await renderAtlas({ strand: 'CNT', band: '5-6' });
    const clear = [...container.querySelectorAll('a')].find((a) =>
      /clear all filters/i.test(a.textContent ?? ''),
    );
    expect(clear).toBeDefined();
    expect(clear?.getAttribute('href')).toBe('/atlas');
  });

  it('ignores nonsense in the URL rather than erroring', async () => {
    const { container } = await renderAtlas({ strand: 'NOPE', band: 'x', points: '9' });
    expect(skillIdsIn(container)).toEqual(allIds);
  });
});

describe('the side panel', () => {
  it('is a prompt, not a blank, before anything is focused', async () => {
    const { container } = await renderAtlas({});
    expect(container.textContent).toMatch(/Choose a skill to see what it is/);
  });

  it('summarises the focused skill and links to its page', async () => {
    await renderAtlas({ focus: 'GEO-10' });
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Nets and folding, 2D to 3D',
    );
    expect(within(panel).getByRole('link', { name: /open the skill page/i })).toHaveAttribute(
      'href',
      '/skill/GEO-10',
    );
  });

  it("lists the focused skill's prerequisites and unlocks", async () => {
    await renderAtlas({ focus: 'GEO-11' });
    const panel = screen.getByRole('complementary');
    expect(within(panel).getByRole('link', { name: /GEO-10/ })).toBeInTheDocument();
  });

  it('keeps the filters when the panel is closed', async () => {
    await renderAtlas({ focus: 'GEO-10', strand: 'GEO', band: '5-6' });
    const close = screen.getByRole('link', { name: 'Close' });
    const href = close.getAttribute('href') ?? '';
    expect(href).toContain('strand=GEO');
    expect(href).toContain('band=5-6');
    expect(href).not.toContain('focus=');
  });

  it('ignores a focus on a skill that does not exist', async () => {
    const { container } = await renderAtlas({ focus: 'ZZZ-99' });
    expect(container.textContent).toMatch(/Choose a skill/);
  });
});

describe('/atlas/[strand]', () => {
  it('builds one page per strand', () => {
    expect(strandParams().map((p) => p.strand)).toEqual([...STRANDS]);
  });

  it.each(STRANDS)('%s walks its skills foundation, core, gateway', async (strand: Strand) => {
    const { container, unmount } = render(
      await StrandPage({ params: Promise.resolve({ strand }) }),
    );
    const headings = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(headings.slice(0, 3)).toEqual(['Foundation', 'Core', 'Gateway']);

    const ids = skillIdsIn(container as HTMLElement);
    expect(ids.sort()).toEqual(
      getSkillsByStrand(strand)
        .map((s) => s.id)
        .sort(),
    );
    unmount();
  });

  it('explains an empty tier rather than leaving a gap', async () => {
    // PAT has no foundation-only gaps, but several strands lack a tier; find one.
    const strandWithGap = STRANDS.find((strand) =>
      ['foundation', 'core', 'gateway'].some(
        (tier) => getSkillsByStrand(strand).filter((s) => s.tier === tier).length === 0,
      ),
    );
    if (!strandWithGap) return;
    const { container } = render(
      await StrandPage({ params: Promise.resolve({ strand: strandWithGap }) }),
    );
    expect(container.textContent).toMatch(/a fact about the strand rather than a gap/);
  });

  it('404s on an unknown strand', async () => {
    await expect(StrandPage({ params: Promise.resolve({ strand: 'XXX' }) })).rejects.toThrow();
  });
});
