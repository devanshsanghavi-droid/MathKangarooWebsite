import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProblemsPage, * as route from '../problems/page';
import { getAllProblems, getProblem, getProblemsForSkill } from '@/lib/content';
import { BANK_PAGE_SIZE } from '@/lib/bank-filter';
import { PRACTICE_SET_MAX, parsePracticeSetQuery } from '@/lib/practice-item';
import { saveAttempt } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

const ALL = getAllProblems();

function idsOnPage(container: HTMLElement): string[] {
  const list = container.querySelector('ol[aria-labelledby="bank-list-heading"]');
  return [...(list?.querySelectorAll('a[href^="/problem/"]') ?? [])]
    .map((link) => /^\/problem\/(KA-\d{4})$/.exec(link.getAttribute('href') ?? '')?.[1] ?? '')
    .filter(Boolean);
}

async function renderLoaded(path = '/problems') {
  window.history.replaceState(null, '', path);
  const utils = render(ProblemsPage());
  await waitFor(() => expect(utils.container.querySelector('[data-bank-loaded]')).not.toBeNull());
  return utils;
}

function filters() {
  return screen.getByRole('complementary', { name: 'Filters' });
}

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  installStaticDataFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the question bank page is static', () => {
  it('reads no searchParams and is force-static', () => {
    expect(route.dynamic).toBe('force-static');
    expect(ProblemsPage.length).toBe(0);
  });

  it('server-renders the first page of real problems before any script runs', () => {
    const fetchMock = installStaticDataFetch();
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    const { container } = render(ProblemsPage());
    expect(idsOnPage(container)).toEqual(
      ALL.slice(0, BANK_PAGE_SIZE)
        .map((p) => p.id)
        .sort(),
    );
    expect(screen.getByText(String(ALL.length))).toBeInTheDocument();
  });

  it('shows no filter counts until the whole index has arrived', () => {
    // Before the fetch resolves only the first page is known; counting from it would report a
    // fraction of the bank as if it were all of it.
    installStaticDataFetch().mockImplementation(() => new Promise<Response>(() => {}));
    render(ProblemsPage());
    expect(within(filters()).queryByText(/ of \d+ solved/)).toBeNull();
    for (const strand of ['Number & Arithmetic', 'Contest Craft']) {
      expect(within(filters()).getByRole('button', { name: new RegExp(strand) })).toBeVisible();
    }
  });

  it('has no filter links: every control is a button or a checkbox', async () => {
    await renderLoaded();
    expect(within(filters()).queryAllByRole('link')).toHaveLength(0);
    expect(within(filters()).getAllByRole('checkbox').length).toBeGreaterThan(5);
  });
});

// A thousand problems means twenty pages of real rows rendered in jsdom, and every filter click
// re-renders the list. That is honest work, not a hang, so this block gets more than the default
// five seconds when the whole suite is competing for the machine.
describe('filtering in the browser', { timeout: 30_000 }, () => {
  it('shows the whole bank count and paginates without dropping or repeating a problem', async () => {
    const user = userEvent.setup();
    const { container } = await renderLoaded();
    const pages = Math.ceil(ALL.length / BANK_PAGE_SIZE);
    expect(screen.getByText(`Page 1 of ${pages}`)).toBeInTheDocument();
    const seen: string[] = [];
    for (let page = 1; page <= pages; page += 1) {
      seen.push(...idsOnPage(container));
      if (page < pages) await user.click(screen.getByRole('button', { name: 'Next page' }));
    }
    expect(seen.sort()).toEqual(ALL.map((p) => p.id).sort());
  });

  it('filters by level and mirrors it into the URL', async () => {
    const user = userEvent.setup();
    const { container } = await renderLoaded();
    await user.click(screen.getAllByRole('radio', { name: 'Level 5-6' })[0] as HTMLElement);
    const shown = idsOnPage(container);
    expect(shown.length).toBeGreaterThan(0);
    for (const id of shown) expect(getProblem(id)?.band, id).toBe('5-6');
    expect(window.location.search).toBe('?level=5-6');
  });

  it('filters by skill, including problems that tag it as secondary', async () => {
    const user = userEvent.setup();
    const { container } = await renderLoaded();
    const panel = filters();
    await user.click(within(panel).getByRole('button', { name: /Counting/ }));
    const row = within(panel)
      .getAllByRole('checkbox')
      .find((box) => box.closest('label')?.textContent?.includes('Counting by position'));
    if (!row) throw new Error('no CNT-12 checkbox');
    await user.click(row);
    const all = getProblemsForSkill('CNT-12').map((p) => p.id);
    const shown = idsOnPage(container);
    expect(shown.length).toBe(Math.min(all.length, BANK_PAGE_SIZE));
    for (const id of shown) expect(all, id).toContain(id);
    expect(window.location.search).toBe('?skill=CNT-12');
  });

  it('shows solved / total on each skill row', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await user.click(within(filters()).getByRole('button', { name: /Counting/ }));
    const total = getProblemsForSkill('CNT-12').length;
    const row = within(filters())
      .getAllByRole('checkbox')
      .find((box) => box.closest('label')?.textContent?.includes('Counting by position'));
    expect(row?.closest('label')?.textContent).toContain(`0 of ${total} solved`);
  });

  it('filters by difficulty', async () => {
    const user = userEvent.setup();
    const { container } = await renderLoaded();
    await user.click(within(filters()).getByRole('checkbox', { name: /5 points/ }));
    for (const id of idsOnPage(container)) expect(getProblem(id)?.points, id).toBe(5);
  });

  it('filters by status from the progress saved in this browser', async () => {
    const solved = ALL[3];
    if (!solved) throw new Error('bank too small');
    saveAttempt([solved.skills.primary, ...solved.skills.secondary], {
      problemId: solved.id,
      points: solved.points,
      correct: true,
      hintsUsed: 0,
      at: new Date().toISOString(),
    });
    resetProgressCache();
    const user = userEvent.setup();
    const { container } = await renderLoaded();
    await user.click(within(filters()).getByRole('checkbox', { name: /^Solved/ }));
    expect(idsOnPage(container)).toEqual([solved.id]);
  });

  it('reads a shared selection back out of the URL', async () => {
    const { container } = await renderLoaded('/problems?level=3-4&points=4');
    await waitFor(() => expect(idsOnPage(container).length).toBeGreaterThan(0));
    for (const id of idsOnPage(container)) {
      expect(getProblem(id)?.band, id).toBe('3-4');
      expect(getProblem(id)?.points, id).toBe(4);
    }
  });

  it('shows a written empty state, with a way out', async () => {
    const user = userEvent.setup();
    const { container } = await renderLoaded('/problems?level=1-2&points=5&figure=1&status=solved');
    expect(await screen.findByText(/matches these filters/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(idsOnPage(container)).toHaveLength(BANK_PAGE_SIZE);
  });
});

describe('starting practice', () => {
  it('starts a set of the selection, capped and unsolved first', async () => {
    await renderLoaded('/problems?level=5-6');
    const link = await screen.findByRole('link', { name: /Start practice/ });
    const query = parsePracticeSetQuery(
      new URL(link.getAttribute('href') ?? '', 'http://x').search,
    );
    expect(query.bank).toBe('ka');
    expect(query.ids.length).toBe(
      Math.min(PRACTICE_SET_MAX, ALL.filter((p) => p.band === '5-6').length),
    );
    for (const id of query.ids) expect(getProblem(id)?.band).toBe('5-6');
  });

  it('offers a random unsolved problem', async () => {
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Random unsolved' })).toBeEnabled();
  });
});
