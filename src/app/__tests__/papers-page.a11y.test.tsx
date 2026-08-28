import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { join } from 'node:path';
import { auditBothThemes } from '@/lib/a11y';
import type * as contentModule from '@/lib/content';
import { buildContentIndex } from '@/lib/content';
import type { PaperIndex } from '@/lib/schemas';

type ContentModule = typeof contentModule;

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
const PaperPage = (await import('../papers/[slug]/page')).default;

const fixture = buildContentIndex(
  join(process.cwd(), 'scripts', '__fixtures__', 'skill-reference', 'pass', 'content'),
);
const fixturePaper = [...fixture.papers.values()][0];

describe('the paper index', () => {
  it('has no axe violations when empty, in either theme', async () => {
    state.papers = [];
    const { container } = render(PapersPage());
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations when populated, in either theme', async () => {
    state.papers = fixturePaper ? [fixturePaper] : [];
    const { container } = render(PapersPage());
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations on a paper page, table included', async () => {
    state.papers = fixturePaper ? [fixturePaper] : [];
    const { container } = render(
      await PaperPage({ params: Promise.resolve({ slug: '2019-3-4' }) }),
    );
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
