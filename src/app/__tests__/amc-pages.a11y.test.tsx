import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import AmcPage from '../amc/page';
import AmcLayout from '../amc/layout';
import AmcProblemsPage from '../amc/problems/page';
import AmcProblemPage from '../amc/problem/[id]/page';
import AmcTypesPage from '../amc/types/page';
import AmcTypePage from '../amc/type/[id]/page';
import AmcFormulasPage from '../amc/formulas/page';
import AmcFormulaDrillPage from '../amc/formulas/drill/page';
import AmcPracticePage from '../amc/practice/page';
import { getAllAmcProblems, getAmcTaxonomy } from '@/lib/amc-content';
import { buildAmcIndex, dataPaths } from '@/lib/bank-data';
import { amcPracticeItem } from '@/lib/practice-item';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => '/amc/problems' };
});
vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const problems = getAllAmcProblems();
const taxonomy = getAmcTaxonomy();
const topicName = (id: string) => taxonomy.topics.find((topic) => topic.id === id)?.name;
const withFormulas = problems.find((p) => p.formulas.length > 0) ?? problems[0];
const type = taxonomy.types.find((t) => problems.some((p) => p.types.includes(t.id)));
if (!withFormulas || !type) throw new Error('the AMC beta needs content to audit');

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  const items = Object.fromEntries(
    problems.slice(0, 3).map((p) => [dataPaths.problem(p.id), amcPracticeItem(p, topicName)]),
  );
  installStaticDataFetch({ [dataPaths.amcIndex]: buildAmcIndex(problems), ...items });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the AMC beta pages', () => {
  it('/amc, inside the AMC layout, has no axe violations in either theme', async () => {
    const { container } = render(AmcLayout({ children: AmcPage() }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/amc with the topic lists open has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = render(AmcPage());
    for (const summary of screen.getAllByText(/^Topics \(\d+\)$/)) await user.click(summary);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it.each([
    ['unfiltered', '/amc/problems'],
    ['filtered', '/amc/problems?level=AMC12&type=T-CASEWORK&points=5'],
    ['empty', '/amc/problems?level=AMC10&points=5&figure=1&status=solved'],
  ])('/amc/problems has no axe violations when %s', async (_label, path) => {
    window.history.replaceState(null, '', path);
    const { container } = render(AmcProblemsPage());
    await waitFor(() => expect(container.querySelector('[data-bank-loaded]')).not.toBeNull());
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/amc/problems with an area open and the mobile filter sheet showing has no violations', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/amc/problems');
    const { container } = render(AmcProblemsPage());
    await waitFor(() => expect(container.querySelector('[data-bank-loaded]')).not.toBeNull());
    const panel = screen.getByRole('complementary', { name: 'Filters' });
    await user.click(within(panel).getByRole('button', { name: /Geometry/ }));
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/amc/problem/[id] has no axe violations, before and after checking an answer', async () => {
    const user = userEvent.setup();
    const { container } = render(
      await AmcProblemPage({ params: Promise.resolve({ id: withFormulas.id }) }),
    );
    expect(await auditBothThemes(container)).toEqual([]);
    const wrong = withFormulas.choices.find((choice) => !choice.correct);
    if (!wrong) return;
    const choices = screen.getByRole('group', { name: /answer choices/i });
    const index = withFormulas.choices.indexOf(wrong);
    const button = within(choices).getAllByRole('button')[index];
    if (!button) throw new Error('choice button missing');
    await user.click(button);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/amc/types has no axe violations', async () => {
    const { container } = render(AmcTypesPage());
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/amc/type/[id] has no axe violations', async () => {
    const { container } = render(await AmcTypePage({ params: Promise.resolve({ id: type.id }) }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  // The whole sheet is ~90 KaTeX-heavy cards, too slow to audit twice in jsdom. The filtered
  // view uses exactly the same card markup, so it is the one audited.
  it('/amc/formulas has no axe violations', { timeout: 90_000 }, async () => {
    const user = userEvent.setup();
    const { container } = render(AmcFormulasPage());
    await user.click(screen.getByRole('radio', { name: 'AMC 12' }));
    await user.click(screen.getByRole('checkbox', { name: 'Must-know only' }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/amc/formulas/drill has no axe violations on the start screen, a card, and its back', async () => {
    const user = userEvent.setup();
    const { container } = render(AmcFormulaDrillPage());
    const start = await screen.findByRole('button', { name: /^Start/ });
    expect(await auditBothThemes(container)).toEqual([]);
    await user.click(start);
    expect(await auditBothThemes(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Show the formula' }));
    expect(await auditBothThemes(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'End sitting' }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/amc/practice running an AMC set has no axe violations', async () => {
    const ids = problems.slice(0, 3).map((p) => p.id);
    window.history.replaceState(null, '', `/amc/practice?bank=amc&ids=${ids.join(',')}`);
    const { container } = render(AmcPracticePage());
    await screen.findAllByText(/Question 1 of 3/);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
