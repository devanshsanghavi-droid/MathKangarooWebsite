import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import ProblemsPage from '../problems/page';
import AmcProblemsPage from '../amc/problems/page';
import SatProblemsPage from '../sat/problems/page';
import ActProblemsPage from '../act/problems/page';
import { PracticeSession } from '@/components/practice-session';
import { getAllProblems, getSkill } from '@/lib/content';
import { getAllAmcProblems } from '@/lib/amc-content';
import { getAllTestProblems, getTestTaxonomy } from '@/lib/test-content';
import { buildAmcIndex, buildTestIndexFile, dataPaths } from '@/lib/bank-data';
import { kaPracticeItem } from '@/lib/practice-item';
import { saveAttempt, toggleSaved } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

/** docs/08 items 10-11: axe over the banks' new controls and the practice second try. */

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => '/problems' };
});
vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const ALL = getAllProblems();
const sat = getAllTestProblems('SAT');
const act = getAllTestProblems('ACT');

async function renderLoaded(page: () => React.ReactElement, path: string) {
  window.history.replaceState(null, '', path);
  const utils = render(page());
  await waitFor(() => expect(utils.container.querySelector('[data-bank-loaded]')).not.toBeNull());
  return utils;
}

beforeEach(() => {
  window.localStorage.clear();
  const [a, b] = ALL;
  if (a) toggleSaved(a.id);
  if (b) {
    saveAttempt([b.skills.primary, ...b.skills.secondary], {
      problemId: b.id,
      points: b.points,
      correct: false,
      hintsUsed: 0,
      at: new Date().toISOString(),
    });
  }
  resetProgressCache();
  installStaticDataFetch({
    [dataPaths.amcIndex]: buildAmcIndex(getAllAmcProblems()),
    [dataPaths.satIndex]: buildTestIndexFile(getTestTaxonomy('SAT'), sat),
    [dataPaths.actIndex]: buildTestIndexFile(getTestTaxonomy('ACT'), act),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the question banks with search, Saved and Missed', () => {
  it.each([
    ['/problems searching', ProblemsPage, '/problems?q=count'],
    ['/problems with Saved and Missed ticked', ProblemsPage, '/problems?status=saved,missed'],
    ['/amc/problems searching', AmcProblemsPage, '/amc/problems?q=triangle'],
    ['/sat/problems with Saved ticked', SatProblemsPage, '/sat/problems?status=saved'],
    ['/act/problems searching', ActProblemsPage, '/act/problems?q=x'],
  ])('%s has no axe violations in either theme', async (_label, page, path) => {
    const { container } = await renderLoaded(page, path);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('labels the search box and the quick-practice controls', async () => {
    await renderLoaded(ProblemsPage, '/problems');
    expect(screen.getByRole('searchbox', { name: 'Search problems' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice saved (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice missed (1)' })).toBeInTheDocument();
  });
});

describe('the practice session with the polish', () => {
  it('has no axe violations on the second-try nudge, with Save pressed', async () => {
    const user = userEvent.setup();
    const items = ALL.slice(0, 2).map((p) => kaPracticeItem(p, (id) => getSkill(id)?.name));
    const first = items[0];
    if (!first) throw new Error('no items');
    const wrong = first.choices.find((c) => !c.correct)?.key ?? 'A';
    const { container } = render(<PracticeSession items={items} title="Practice set" />);
    await user.click(screen.getByRole('button', { name: /^Save/ }));
    const group = screen.getByRole('group', { name: /answer choices/i });
    const button = within(group)
      .getAllByRole('button')
      .find((b) => b.textContent?.trim().startsWith(wrong));
    if (!button) throw new Error('no choice');
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'retry');
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
