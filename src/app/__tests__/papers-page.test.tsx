import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { join } from 'node:path';
import type * as contentModule from '@/lib/content';
import { buildContentIndex } from '@/lib/content';
import type { PaperIndex } from '@/lib/schemas';

type ContentModule = typeof contentModule;

/**
 * The papers pages read from the global content index. To exercise the populated path without
 * inventing an analysis of a real paper — which would be worse than no analysis, because it
 * would send a student to the wrong skill — these tests inject the fixture paper instead.
 */
const state = vi.hoisted(() => ({ papers: [] as PaperIndex[] }));

vi.mock('@/lib/content', async (importOriginal) => {
  const actual = (await importOriginal()) as ContentModule;
  return {
    ...actual,
    getAllPapers: () => state.papers,
    getPaper: (year: number, band: string) =>
      state.papers.find((paper) => paper.year === year && paper.band === band),
  };
});

const PapersPage = (await import('../papers/page')).default;
const paperModule = await import('../papers/[slug]/page');
const PaperPage = paperModule.default;

const fixture = buildContentIndex(
  join(process.cwd(), 'scripts', '__fixtures__', 'skill-reference', 'pass', 'content'),
);
const fixturePaper = [...fixture.papers.values()][0];

beforeEach(() => {
  state.papers = [];
});

describe('/papers with nothing indexed', () => {
  it('explains what the index is before anything else', () => {
    const { container } = render(PapersPage());
    expect(container.textContent).toMatch(/our analysis/i);
    expect(container.textContent).toMatch(/not reproduced here|never will be/i);
  });

  it('says why it is empty, in a sentence, and offers somewhere to go', () => {
    render(PapersPage());
    expect(screen.getByText(/No paper has been indexed yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Skill Atlas/i })).toHaveAttribute('href', '/atlas');
  });

  it('points at the official site rather than mirroring it', () => {
    const { container } = render(PapersPage());
    const links = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('https://mathkangaroo.org');
    expect(links.some((href) => href?.endsWith('.pdf'))).toBe(false);
  });
});

describe('/papers with an index', () => {
  beforeEach(() => {
    if (fixturePaper) state.papers = [fixturePaper];
  });

  it('lists the paper, grouped by band', () => {
    render(PapersPage());
    expect(screen.getByRole('link', { name: /2019, level 3–4/ })).toHaveAttribute(
      'href',
      '/papers/2019-3-4',
    );
  });

  it('marks a partial index as partial rather than implying it is whole', () => {
    const { container } = render(PapersPage());
    expect(container.textContent).toContain('2 of 24 questions');
    expect(container.textContent).toContain('partial index');
  });

  it('shows the skills most tested in the band', () => {
    const { container } = render(PapersPage());
    expect(container.textContent).toMatch(/Skills most tested at level 3–4/);
    expect(container.textContent).toContain('NUM-01');
  });

  it('explains why the counts add to more than the number of questions', () => {
    const { container } = render(PapersPage());
    expect(container.textContent).toMatch(/counts once for each/);
  });
});

describe('/papers/[year]-[band]', () => {
  beforeEach(() => {
    if (fixturePaper) state.papers = [fixturePaper];
  });

  it('builds one page per indexed paper', () => {
    expect(paperModule.generateStaticParams()).toEqual([{ slug: '2019-3-4' }]);
  });

  it('titles the page after the paper', async () => {
    const meta = await paperModule.generateMetadata({
      params: Promise.resolve({ slug: '2019-3-4' }),
    });
    expect(meta.title).toBe('2019, level 3–4 — skill index');
    expect(meta.description).toMatch(/No question text, figures or answers/);
  });

  it('refuses to index a page for a paper we do not have', async () => {
    const meta = await paperModule.generateMetadata({
      params: Promise.resolve({ slug: '1999-3-4' }),
    });
    expect(meta.robots).toEqual({ index: false });
  });

  it('renders a question table with our tags and no question text', async () => {
    render(await PaperPage({ params: Promise.resolve({ slug: '2019-3-4' }) }));
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['#', 'Points', 'Skills we tagged', 'Our note']);
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 questions
    // Both fixture questions tag NUM-01, so there are two links to it.
    for (const link of within(table).getAllByRole('link', { name: /NUM-01/ })) {
      expect(link).toHaveAttribute('href', '/skill/NUM-01');
    }
  });

  it('links out to the official PDF and never to a local copy', async () => {
    const { container } = render(
      await PaperPage({ params: Promise.resolve({ slug: '2019-3-4' }) }),
    );
    const pdf = [...container.querySelectorAll('a')].find((a) =>
      a.getAttribute('href')?.endsWith('.pdf'),
    );
    expect(pdf?.getAttribute('href')).toMatch(/^https:\/\/mathkangaroo\.org\//);
    expect(pdf?.textContent).toMatch(/official paper on mathkangaroo\.org/i);
  });

  it('states on the page that it holds no question text, figures or answers', async () => {
    const { container } = render(
      await PaperPage({ params: Promise.resolve({ slug: '2019-3-4' }) }),
    );
    expect(container.textContent).toMatch(/no question text, no figures and no answers/i);
  });

  it('shows the point distribution and how much of the paper is indexed', async () => {
    const { container } = render(
      await PaperPage({ params: Promise.resolve({ slug: '2019-3-4' }) }),
    );
    expect(container.textContent).toContain('2 of 24 questions indexed');
    expect(container.textContent).toMatch(/This index is partial/);
  });

  it('404s on a slug that is not a paper', async () => {
    await expect(PaperPage({ params: Promise.resolve({ slug: 'nonsense' }) })).rejects.toThrow();
    await expect(PaperPage({ params: Promise.resolve({ slug: '1999-3-4' }) })).rejects.toThrow();
  });
});

describe('the repository holds no official content — CLAUDE.md non-negotiable #1', () => {
  it('has no paper file over the tripwire cap', async () => {
    const { readdirSync, statSync, existsSync } = await import('node:fs');
    const dir = join(process.cwd(), 'content', 'papers');
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      expect(statSync(join(dir, entry)).size, entry).toBeLessThanOrEqual(2048);
    }
  });

  it('has no PDF anywhere in content/', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
      );
    const files = walk(join(process.cwd(), 'content'));
    expect(files.filter((file) => /\.(pdf|png|jpe?g|gif|webp)$/i.test(file))).toEqual([]);
    expect(files.every((file) => statSync(file).isFile())).toBe(true);
  });
});
