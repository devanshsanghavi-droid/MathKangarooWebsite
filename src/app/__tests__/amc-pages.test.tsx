import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AmcPage from '../amc/page';
import AmcLayout from '../amc/layout';
import AmcProblemsPage from '../amc/problems/page';
import AmcProblemPage, {
  generateMetadata as problemMetadata,
  generateStaticParams as problemParams,
} from '../amc/problem/[id]/page';
import AmcTypesPage from '../amc/types/page';
import AmcTypePage, {
  generateMetadata as typeMetadata,
  generateStaticParams as typeParams,
} from '../amc/type/[id]/page';
import AmcFormulasPage from '../amc/formulas/page';
import AmcFormulaDrillPage from '../amc/formulas/drill/page';
import sitemap from '../sitemap';
import { getAllAmcProblems, getAmcFormulas, getAmcTaxonomy } from '@/lib/amc-content';
import { buildAmcIndex, dataPaths } from '@/lib/bank-data';
import { AMC_DISCLAIMER, SITE } from '@/lib/site';
import { FORMULA_DRILL_KEY } from '@/lib/formula-drill';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => '/amc/types' };
});
vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const problems = getAllAmcProblems();
const taxonomy = getAmcTaxonomy();
const formulas = getAmcFormulas();
const firstProblem = problems[0];
const firstType = [...taxonomy.types].sort(
  (a, b) =>
    problems.filter((p) => p.types.includes(b.id)).length -
    problems.filter((p) => p.types.includes(a.id)).length,
)[0];
if (!firstProblem || !firstType) throw new Error('the AMC beta needs content to test against');

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  installStaticDataFetch({ [dataPaths.amcIndex]: buildAmcIndex(problems) });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the AMC layout', () => {
  it('carries the MAA notice and the beta section links', () => {
    render(AmcLayout({ children: <p>page</p> }));
    expect(screen.getByRole('note', { name: 'Trademark notice' })).toHaveTextContent(
      AMC_DISCLAIMER,
    );
    const nav = screen.getByRole('navigation', { name: 'AMC beta sections' });
    expect(within(nav).getByRole('link', { name: 'Problem types' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });
});

describe('/amc', () => {
  it('shows a card per area and switches between the AMC 10 and AMC 12', async () => {
    const user = userEvent.setup();
    render(AmcPage());
    expect(screen.getByRole('heading', { level: 1, name: 'AMC practice' })).toBeInTheDocument();
    for (const area of taxonomy.areas) {
      expect(screen.getByRole('heading', { level: 3, name: area.name })).toBeInTheDocument();
    }
    const amc10 = problems.filter((p) => p.contest !== 'AMC12').length;
    const amc12 = problems.filter((p) => p.contest !== 'AMC10').length;
    expect(screen.getByText(`of ${amc10} solved`)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'AMC 12' }));
    expect(screen.getByText(`of ${amc12} solved`)).toBeInTheDocument();
    expect(window.localStorage.getItem('ka-amc-paper')).toBe('AMC12');
    expect(screen.getByRole('button', { name: /Start a mixed set/ })).toBeEnabled();
  });
});

describe('/amc/problems', () => {
  it('is the shared bank with AMC filters, and starts sets under /amc/practice', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/amc/problems');
    const { container } = render(AmcProblemsPage());
    await waitFor(() => expect(container.querySelector('[data-bank-loaded]')).not.toBeNull());
    const panel = screen.getByRole('complementary', { name: 'Filters' });
    expect(within(panel).getByRole('radio', { name: 'AMC 12' })).toBeInTheDocument();
    expect(within(panel).getByText('Problem types')).toBeInTheDocument();
    expect(within(panel).getByText('Middle')).toBeInTheDocument();

    await user.click(within(panel).getByRole('radio', { name: 'AMC 12' }));
    expect(window.location.search).toBe('?level=AMC12');
    const start = screen.getByRole('link', { name: /Start practice/ });
    expect(start.getAttribute('href')).toMatch(/^\/amc\/practice\?bank=amc&ids=AM-\d{4}/);
  });
});

describe('/amc/problem/[id]', () => {
  it('has one static page per problem', () => {
    expect(problemParams().map((p) => p.id)).toEqual(problems.map((p) => p.id));
  });

  it('names the topic in the title and never quotes the statement in the description', async () => {
    const meta = await problemMetadata({ params: Promise.resolve({ id: firstProblem.id }) });
    expect(String(meta.title)).toContain(firstProblem.id);
    expect(meta.alternates?.canonical).toBe(`/amc/problem/${firstProblem.id}`);
    expect(String(meta.description)).not.toContain('$');
    const missing = await problemMetadata({ params: Promise.resolve({ id: 'AM-9999' }) });
    expect(missing.robots).toEqual({ index: false });
  });

  it('server-renders the statement typeset, with five choices and the type links', async () => {
    const { container } = render(
      await AmcProblemPage({ params: Promise.resolve({ id: firstProblem.id }) }),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(firstProblem.id);
    if (firstProblem.statement.includes('$')) {
      expect(container.querySelector('.katex')).not.toBeNull();
    }
    expect(container.textContent).not.toContain('$');
    for (const typeId of firstProblem.types) {
      const type = taxonomy.types.find((t) => t.id === typeId);
      if (type) {
        expect(screen.getByRole('link', { name: type.name })).toHaveAttribute(
          'href',
          `/amc/type/${type.id}`,
        );
      }
    }
    expect(screen.getByRole('link', { name: 'Report an error in this problem' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent(firstProblem.id)),
    );
    const structured = container.querySelector('script[type="application/ld+json"]');
    const correct = firstProblem.choices.find((c) => c.correct);
    expect(structured?.textContent).not.toContain(correct?.text ?? '###');
  });
});

describe('/amc/types and /amc/type/[id]', () => {
  it('lists every type and filters them by area', async () => {
    const user = userEvent.setup();
    render(AmcTypesPage());
    for (const type of taxonomy.types) {
      expect(screen.getByRole('link', { name: type.name })).toHaveAttribute(
        'href',
        `/amc/type/${type.id}`,
      );
    }
    const area = taxonomy.areas[1];
    if (!area) return;
    await user.click(screen.getByRole('radio', { name: area.name }));
    const shown = taxonomy.types.filter((t) => t.areas.includes(area.id));
    expect(screen.getAllByRole('article')).toHaveLength(shown.length);
  });

  it('has one page per type with its cues, its problems and a practice link', async () => {
    expect(
      typeParams()
        .map((p) => p.id)
        .sort(),
    ).toEqual(taxonomy.types.map((t) => t.id).sort());
    const meta = await typeMetadata({ params: Promise.resolve({ id: firstType.id }) });
    expect(meta.description).toBe(firstType.description);

    render(await AmcTypePage({ params: Promise.resolve({ id: firstType.id }) }));
    expect(screen.getByRole('heading', { level: 1, name: firstType.name })).toBeInTheDocument();
    for (const cue of firstType.recognizeWhen) expect(screen.getByText(cue)).toBeInTheDocument();
    const count = problems.filter((p) => p.types.includes(firstType.id)).length;
    const list = screen.getByRole('list', { name: `Problems of this type (${count})` });
    expect(within(list).getAllByRole('listitem')).toHaveLength(count);
    expect(screen.getByRole('link', { name: /Practise these/ }).getAttribute('href')).toMatch(
      /^\/amc\/practice\?bank=amc&ids=/,
    );
  });
});

describe('/amc/formulas', () => {
  it('shows every formula by area, and the contest and must-know filters narrow it', async () => {
    const user = userEvent.setup();
    render(AmcFormulasPage());
    const count = () => screen.getByText(/^\d+ formulas?$/).textContent;
    expect(count()).toBe(`${formulas.length} formulas`);
    for (const area of taxonomy.areas) {
      expect(screen.getByRole('heading', { level: 2, name: area.name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('checkbox', { name: 'Must-know only' }));
    const must = formulas.filter((f) => f.priority === 'must-know').length;
    expect(count()).toBe(`${must} ${must === 1 ? 'formula' : 'formulas'}`);
    await user.click(screen.getByRole('radio', { name: 'AMC 10' }));
    const both = formulas.filter(
      (f) => f.priority === 'must-know' && f.contests.includes('AMC10'),
    ).length;
    expect(count()).toBe(`${both} ${both === 1 ? 'formula' : 'formulas'}`);
  });
});

describe('/amc/formulas/drill', () => {
  it('runs a sitting from the keyboard and stores the schedule in ka-amc-formulas', async () => {
    const user = userEvent.setup();
    render(AmcFormulaDrillPage());
    const start = await screen.findByRole('button', { name: /^Start \(\d+ cards?\)$/ });
    await user.click(start);

    const card = screen.getByRole('group', { name: formulas[0]?.name });
    expect(screen.getByRole('button', { name: 'Show the formula' })).toBeInTheDocument();
    // Space flips when focus is not on a button.
    card.focus();
    fireEvent.keyDown(card, { key: ' ' });
    const grades = await screen.findByRole('group', { name: 'How well did you remember it?' });
    const buttons = within(grades).getAllByRole('button');
    expect(buttons.map((b) => b.textContent?.replace(/,.*$/, '').trim())).toEqual([
      expect.stringMatching(/Again/),
      expect.stringMatching(/Hard/),
      expect.stringMatching(/Good/),
      expect.stringMatching(/Easy/),
    ]);
    // Neutral, never the reserved feedback colours.
    for (const button of buttons) {
      expect(button.className).not.toMatch(/correct|wrong|hint/);
    }
    fireEvent.keyDown(document.body, { key: '3' });
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'How well did you remember it?' })).toBeNull(),
    );
    const stored = JSON.parse(window.localStorage.getItem(FORMULA_DRILL_KEY) ?? '{}') as {
      cards?: Record<string, unknown>;
    };
    expect(Object.keys(stored.cards ?? {})).toEqual([formulas[0]?.id]);
  });

  it('does not grade while the formula is hidden, and leaves a focused button its own Space', async () => {
    const user = userEvent.setup();
    render(AmcFormulaDrillPage());
    await user.click(await screen.findByRole('button', { name: /^Start/ }));
    fireEvent.keyDown(document.body, { key: '1' });
    expect(window.localStorage.getItem(FORMULA_DRILL_KEY)).toBeNull();
    const end = screen.getByRole('button', { name: 'End sitting' });
    end.focus();
    fireEvent.keyDown(end, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Show the formula' })).toBeInTheDocument();
  });

  it('narrows the deck to must-know formulas', async () => {
    const user = userEvent.setup();
    render(AmcFormulaDrillPage());
    await user.click(await screen.findByRole('checkbox', { name: /Must-know only/ }));
    const must = formulas.filter((f) => f.priority === 'must-know').length;
    expect(screen.getByText('Not started').parentElement?.parentElement).toHaveTextContent(
      String(must),
    );
  });
});

describe('the sitemap', () => {
  it('lists the AMC pages, every type and every AMC problem, but not the practice runner', () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const path of ['/amc', '/amc/problems', '/amc/types', '/amc/formulas']) {
      expect(urls.has(`${SITE.url}${path}`), path).toBe(true);
    }
    for (const type of taxonomy.types)
      expect(urls.has(`${SITE.url}/amc/type/${type.id}`)).toBe(true);
    for (const problem of problems) {
      expect(urls.has(`${SITE.url}/amc/problem/${problem.id}`)).toBe(true);
    }
    expect(urls.has(`${SITE.url}/amc/practice`)).toBe(false);
  });
});
