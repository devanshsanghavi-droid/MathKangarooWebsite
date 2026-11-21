import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProblemsPage from '../problems/page';
import AmcProblemsPage from '../amc/problems/page';
import SatProblemsPage from '../sat/problems/page';
import ActProblemsPage from '../act/problems/page';
import { getAllProblems, getSkill } from '@/lib/content';
import { getAllAmcProblems } from '@/lib/amc-content';
import { getAllTestProblems, getTestTaxonomy } from '@/lib/test-content';
import { buildAmcIndex, buildTestIndexFile, dataPaths } from '@/lib/bank-data';
import { PRACTICE_SET_MAX, parsePracticeSetQuery } from '@/lib/practice-item';
import { saveAttempt, toggleSaved } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

/**
 * docs/08 items 10-11 on the question banks: keyword search, Saved and Missed in the status
 * filter, and "Practice missed" / "Practice saved".
 */

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => '/problems' };
});

const ALL = getAllProblems();
const amc = getAllAmcProblems();
const sat = getAllTestProblems('SAT');
const act = getAllTestProblems('ACT');

function idsOnPage(container: HTMLElement, prefix = '/problem/'): string[] {
  const list = container.querySelector('ol[aria-labelledby$="bank-list-heading"]');
  return [...(list?.querySelectorAll(`a[href^="${prefix}"]`) ?? [])]
    .map((link) => (link.getAttribute('href') ?? '').split('/').pop() ?? '')
    .filter(Boolean);
}

async function renderLoaded(page: () => React.ReactElement, path: string) {
  window.history.replaceState(null, '', path);
  const utils = render(page());
  await waitFor(() => expect(utils.container.querySelector('[data-bank-loaded]')).not.toBeNull());
  return utils;
}

const filters = () => screen.getByRole('complementary', { name: 'Filters' });

function miss(problem: (typeof ALL)[number], minute: number) {
  saveAttempt([problem.skills.primary, ...problem.skills.secondary], {
    problemId: problem.id,
    points: problem.points,
    correct: false,
    hintsUsed: 0,
    at: new Date(Date.UTC(2026, 10, 20, 10, minute)).toISOString(),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  installStaticDataFetch({
    [dataPaths.amcIndex]: buildAmcIndex(amc),
    [dataPaths.satIndex]: buildTestIndexFile(getTestTaxonomy('SAT'), sat),
    [dataPaths.actIndex]: buildTestIndexFile(getTestTaxonomy('ACT'), act),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('keyword search', { timeout: 30_000 }, () => {
  it('finds problems by a word of the statement and mirrors it into the URL', async () => {
    const user = userEvent.setup();
    const target = ALL.find((p) => /\b[a-z]{7,}\b/i.test(p.statement.slice(0, 200)));
    const word = /\b([a-z]{7,})\b/i.exec(target?.statement.slice(0, 200) ?? '')?.[1];
    if (!target || !word) throw new Error('no searchable word');
    const { container } = await renderLoaded(ProblemsPage, '/problems');
    await user.type(screen.getByRole('searchbox', { name: 'Search problems' }), word);
    const shown = idsOnPage(container);
    expect(shown).toContain(target.id);
    expect(shown.length).toBeLessThan(ALL.length);
    expect(new URLSearchParams(window.location.search).get('q')).toBe(word);
  });

  it('finds problems by skill name', async () => {
    const skillName = getSkill('CNT-12')?.name ?? '';
    const { container } = await renderLoaded(
      ProblemsPage,
      `/problems?q=${encodeURIComponent(skillName)}`,
    );
    await waitFor(() => expect(idsOnPage(container).length).toBeGreaterThan(0));
    expect(screen.getByRole('searchbox', { name: 'Search problems' })).toHaveValue(skillName);
    expect(
      idsOnPage(container).some((id) => ALL.find((p) => p.id === id)?.skills.primary === 'CNT-12'),
    ).toBe(true);
  });

  it('shows the empty state for a search that matches nothing, and Clear all clears it', async () => {
    const user = userEvent.setup();
    const { container } = await renderLoaded(ProblemsPage, '/problems?q=zzzqqqxxx');
    expect(await screen.findByText(/matches these filters/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search problems' })).toHaveValue('');
    expect(idsOnPage(container).length).toBeGreaterThan(0);
  });

  it('is on the AMC, SAT and ACT banks too', async () => {
    for (const [page, path, noun] of [
      [AmcProblemsPage, '/amc/problems', 'problems'],
      [SatProblemsPage, '/sat/problems', 'questions'],
      [ActProblemsPage, '/act/problems', 'questions'],
    ] as const) {
      const { unmount } = await renderLoaded(page, path);
      expect(screen.getByRole('searchbox', { name: `Search ${noun}` })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('saved and missed', { timeout: 30_000 }, () => {
  it('filters by Saved and by Missed', async () => {
    const user = userEvent.setup();
    const [a, b, c] = ALL;
    if (!a || !b || !c) throw new Error('bank too small');
    toggleSaved(a.id);
    miss(b, 1);
    miss(c, 2);
    // c is answered right later, so it is no longer missed.
    saveAttempt([c.skills.primary, ...c.skills.secondary], {
      problemId: c.id,
      points: c.points,
      correct: true,
      hintsUsed: 0,
      at: new Date(Date.UTC(2026, 10, 20, 11)).toISOString(),
    });
    resetProgressCache();
    const { container } = await renderLoaded(ProblemsPage, '/problems');
    await user.click(within(filters()).getByRole('checkbox', { name: /^Saved/ }));
    expect(idsOnPage(container)).toEqual([a.id]);
    expect(window.location.search).toBe('?status=saved');
    await user.click(within(filters()).getByRole('checkbox', { name: /^Saved/ }));
    await user.click(within(filters()).getByRole('checkbox', { name: /^Missed/ }));
    expect(idsOnPage(container)).toEqual([b.id]);
  });

  it('starts "Practice missed" and "Practice saved" sets with exactly those ids', async () => {
    const saved = ALL.slice(0, 3).map((p) => p.id);
    for (const id of saved) toggleSaved(id);
    const missed = ALL.slice(5, 5 + PRACTICE_SET_MAX + 3);
    missed.forEach((p, i) => miss(p, i));
    resetProgressCache();
    await renderLoaded(ProblemsPage, '/problems');

    const savedLink = screen.getByRole('link', { name: 'Practice saved (3)' });
    const savedQuery = parsePracticeSetQuery(
      new URL(savedLink.getAttribute('href') ?? '', 'http://x').search,
    );
    expect([...savedQuery.ids].sort()).toEqual([...saved].sort());
    expect(savedQuery.name).toBe('Practice saved');

    // Capped at a set's maximum.
    const missedLink = screen.getByRole('link', {
      name: `Practice missed (${PRACTICE_SET_MAX})`,
    });
    const missedQuery = parsePracticeSetQuery(
      new URL(missedLink.getAttribute('href') ?? '', 'http://x').search,
    );
    expect(missedQuery.ids).toHaveLength(PRACTICE_SET_MAX);
    const missedIds = new Set(missed.map((p) => p.id));
    for (const id of missedQuery.ids) expect(missedIds.has(id), id).toBe(true);
  });

  it('keeps the quick-practice buttons off while there is nothing to practise', async () => {
    await renderLoaded(ProblemsPage, '/problems');
    expect(screen.getByRole('button', { name: 'Practice missed (0)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Practice saved (0)' })).toBeDisabled();
  });

  it('works on the SAT bank, starting sets under /sat', async () => {
    const first = sat[0];
    if (!first) throw new Error('no SAT content');
    toggleSaved(first.id);
    resetProgressCache();
    const { container } = await renderLoaded(SatProblemsPage, '/sat/problems?status=saved');
    await waitFor(() => expect(idsOnPage(container, '/sat/problem/')).toEqual([first.id]));
    expect(screen.getByRole('link', { name: 'Practice saved (1)' }).getAttribute('href')).toBe(
      `/sat/practice?bank=sat&ids=${first.id}&name=Practice+saved`,
    );
  });
});
