import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProblemsPage from '../problems/page';
import { getAllProblems, getProblemsForSkill } from '@/lib/content';
import { PAGE_SIZE, type RawSearchParams } from '@/lib/problem-query';
import { BANDS, STRANDS } from '@/lib/schemas';

/**
 * A filter that currently matches no problem. Prefers a band with nothing in it, and falls
 * back to a band-and-strand pair that is empty, so this keeps working as the bank grows.
 */
function emptyFilter(): Record<string, string> {
  const problems = getAllProblems();
  for (const band of BANDS) {
    if (!problems.some((problem) => problem.band === band)) return { band };
  }
  for (const band of BANDS) {
    for (const strand of STRANDS) {
      const hit = problems.some(
        (problem) => problem.band === band && problem.skills.primary.startsWith(strand),
      );
      if (!hit) return { band, strand };
    }
  }
  throw new Error('every band and strand now has problems - pick a new empty case');
}

async function renderProblems(searchParams: RawSearchParams = {}) {
  return render(await ProblemsPage({ searchParams: Promise.resolve(searchParams) }));
}

function problemIdsIn(container: HTMLElement): string[] {
  const ids = new Set<string>();
  for (const link of container.querySelectorAll('a[href^="/problem/"]')) {
    const match = /^\/problem\/(KA-\d{4})/.exec(link.getAttribute('href') ?? '');
    if (match?.[1]) ids.add(match[1]);
  }
  return [...ids].sort();
}

describe('the browse page', () => {
  it('shows the first page of every problem', async () => {
    const { container } = await renderProblems({});
    expect(problemIdsIn(container)).toHaveLength(Math.min(PAGE_SIZE, getAllProblems().length));
  });

  it('states the result count', async () => {
    await renderProblems({});
    expect(screen.getByText(String(getAllProblems().length))).toBeInTheDocument();
  });

  it('paginates without dropping or repeating a problem', async () => {
    const seen: string[] = [];
    const pageCount = Math.ceil(getAllProblems().length / PAGE_SIZE);
    for (let page = 1; page <= pageCount; page += 1) {
      const { container, unmount } = await renderProblems({ page: String(page) });
      seen.push(...problemIdsIn(container));
      unmount();
    }
    expect(seen.sort()).toEqual(
      getAllProblems()
        .map((p) => p.id)
        .sort(),
    );
  });

  it('filters by band', async () => {
    const { container } = await renderProblems({ band: '5-6', page: '1' });
    for (const id of problemIdsIn(container)) {
      expect(getAllProblems().find((p) => p.id === id)?.band, id).toBe('5-6');
    }
  });

  it('filters by point value', async () => {
    const { container } = await renderProblems({ points: '5' });
    for (const id of problemIdsIn(container)) {
      expect(getAllProblems().find((p) => p.id === id)?.points, id).toBe(5);
    }
  });

  it('filters by strand', async () => {
    const { container } = await renderProblems({ strand: 'LOG' });
    for (const id of problemIdsIn(container)) {
      expect(
        getAllProblems()
          .find((p) => p.id === id)
          ?.skills.primary.startsWith('LOG'),
        id,
      ).toBe(true);
    }
  });

  it('filters by skill, including problems that tag it as secondary', async () => {
    const { container } = await renderProblems({ skill: 'CNT-01' });
    const shown = problemIdsIn(container);
    const all = getProblemsForSkill('CNT-01').map((p) => p.id);
    // A popular skill now carries more problems than fit on a page, so the page is a subset
    // of the skill's problems rather than all of them. Both halves still matter: nothing from
    // another skill leaks in, and the first page is full.
    expect(shown.length).toBe(Math.min(all.length, PAGE_SIZE));
    for (const id of shown) expect(all, id).toContain(id);
  });

  it('names the filtered skill so a shared link explains itself', async () => {
    const { container } = await renderProblems({ skill: 'CNT-12' });
    expect(container.textContent).toContain('Counting by position (sliding window)');
  });

  it('combines filters with AND', async () => {
    const { container } = await renderProblems({ band: '3-4', points: '5' });
    for (const id of problemIdsIn(container)) {
      const problem = getAllProblems().find((p) => p.id === id);
      expect(problem?.band, id).toBe('3-4');
      expect(problem?.points, id).toBe(5);
    }
  });

  it('shows a written empty state, with a way out', async () => {
    /*
     * The empty filter is DERIVED from the bank rather than hard-coded. It used to be
     * band 11-12, which stopped being empty the day problems were authored for that level and
     * took three tests down with it. Asking the content which combination is empty means the
     * test keeps testing the empty state instead of quietly testing a populated one.
     */
    const { container } = await renderProblems(emptyFilter());
    expect(container.textContent).toMatch(/No problem matches these filters/);
    const clear = [...container.querySelectorAll('a')].find((a) =>
      /clear all filters/i.test(a.textContent ?? ''),
    );
    expect(clear).toBeDefined();
  });

  it('is honest that difficulty is not yet measured', async () => {
    const { container } = await renderProblems({ sort: 'difficulty' });
    expect(container.textContent).toMatch(/No problem has been attempted 30 times yet/);
    expect(container.textContent).toMatch(/never from a hand-set field/);
  });

  it('marks uncalibrated problems as such instead of inventing a difficulty', async () => {
    const { container } = await renderProblems({});
    expect(container.textContent).toContain('not yet calibrated');
  });

  it('survives nonsense in the URL', async () => {
    const { container } = await renderProblems({ band: 'x', points: '9', page: 'nope' });
    expect(problemIdsIn(container).length).toBeGreaterThan(0);
  });

  it('clamps a page past the end rather than showing nothing', async () => {
    const { container } = await renderProblems({ page: '999' });
    expect(problemIdsIn(container).length).toBeGreaterThan(0);
  });

  it('links every result to its skill page as well as its problem page', async () => {
    const { container } = await renderProblems({ page: '1' });
    expect(container.querySelectorAll('a[href^="/skill/"]').length).toBeGreaterThan(0);
  });
});

describe('pagination controls', () => {
  it('marks the current page and links the others', async () => {
    await renderProblems({ page: '2' });
    const nav = screen.getByRole('navigation', { name: /pagination/i });
    expect(nav).toBeInTheDocument();
    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveTextContent('2');
  });

  it('carries the filters into every page link', async () => {
    await renderProblems({ band: '5-6', page: '1' });
    const nav = screen.queryByRole('navigation', { name: /pagination/i });
    if (!nav) return; // one page of results is not a pagination failure
    for (const link of nav.querySelectorAll('a')) {
      expect(link.getAttribute('href')).toContain('band=5-6');
    }
  });

  it('disappears when everything fits on one page', async () => {
    await renderProblems({ skill: 'CNT-12' });
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
  });
});
