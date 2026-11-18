import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SatLayout from '../sat/layout';
import SatPage, { generateMetadata as satHomeMetadata } from '../sat/page';
import SatProblemsPage from '../sat/problems/page';
import SatProblemPage, {
  generateMetadata as satProblemMetadata,
  generateStaticParams as satProblemParams,
} from '../sat/problem/[id]/page';
import SatPracticePage from '../sat/practice/page';
import ActLayout from '../act/layout';
import ActPage from '../act/page';
import ActProblemsPage from '../act/problems/page';
import ActProblemPage, { generateStaticParams as actProblemParams } from '../act/problem/[id]/page';
import ExamsPage from '../exams/page';
import HomePage from '../page';
import sitemap from '../sitemap';
import { TestProblemPage } from '@/components/exams/test-pages';
import { getAllTestProblems, getTestTaxonomy } from '@/lib/test-content';
import { buildTestIndexFile, dataPaths } from '@/lib/bank-data';
import { testPracticeItem } from '@/lib/practice-item';
import { ACT_DISCLAIMER, SAT_DISCLAIMER, SITE } from '@/lib/site';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

const pathname = vi.hoisted(() => ({ current: '/sat' }));
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => pathname.current };
});
vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const sat = getAllTestProblems('SAT');
const act = getAllTestProblems('ACT');
const satTaxonomy = getTestTaxonomy('SAT');
const actTaxonomy = getTestTaxonomy('ACT');
const firstSat = sat[0];
const firstAct = act[0];
if (!firstSat || !firstAct) throw new Error('the SAT and ACT areas need content to test against');
const satSkill = (id: string) =>
  satTaxonomy.domains.flatMap((d) => d.skills).find((s) => s.id === id)?.name;

beforeEach(() => {
  pathname.current = '/sat';
  window.localStorage.clear();
  resetProgressCache();
  installStaticDataFetch({
    [dataPaths.satIndex]: buildTestIndexFile(satTaxonomy, sat),
    [dataPaths.actIndex]: buildTestIndexFile(actTaxonomy, act),
    ...Object.fromEntries(
      sat.slice(0, 3).map((p) => [dataPaths.problem(p.id), testPracticeItem(p, satSkill)]),
    ),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the SAT and ACT layouts', () => {
  it('carry each test trademark notice verbatim and the area section links', () => {
    pathname.current = '/sat/problem/SA-0001';
    const { unmount } = render(SatLayout({ children: <p>page</p> }));
    expect(screen.getByRole('note', { name: 'Trademark notice' })).toHaveTextContent(
      SAT_DISCLAIMER,
    );
    expect(SAT_DISCLAIMER).toBe(
      'SAT is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this site.',
    );
    const nav = screen.getByRole('navigation', { name: 'SAT sections' });
    expect(within(nav).getByRole('link', { name: 'Problems' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Mock test' })).toHaveAttribute(
      'href',
      '/sat/mock',
    );
    expect(within(nav).getByRole('link', { name: 'Section test' })).toHaveAttribute(
      'href',
      '/sat/section',
    );
    unmount();

    pathname.current = '/act';
    render(ActLayout({ children: <p>page</p> }));
    expect(screen.getByRole('note', { name: 'Trademark notice' })).toHaveTextContent(
      ACT_DISCLAIMER,
    );
    expect(ACT_DISCLAIMER).toBe(
      'ACT is a registered trademark of ACT Education Corp., which is not affiliated with, and does not endorse, this site.',
    );
    const actNav = screen.getByRole('navigation', { name: 'ACT sections' });
    expect(within(actNav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('/sat and /act', () => {
  it('show a card per domain with its count, and the ways in', () => {
    render(SatPage());
    expect(screen.getByRole('heading', { level: 1, name: 'SAT Math practice' })).toBeVisible();
    for (const domain of satTaxonomy.domains) {
      const card = screen.getByRole('heading', { level: 3, name: domain.name }).closest('article');
      if (!card) throw new Error(`no card for ${domain.id}`);
      const count = sat.filter((p) => p.domain === domain.id).length;
      expect(card).toHaveTextContent(`${count} ${count === 1 ? 'question' : 'questions'}`);
      expect(
        within(card).getByRole('button', {
          name: new RegExp(`^Practice this domain.*${domain.name}$`),
        }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText(`of ${sat.length} solved`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take a mock test' })).toHaveAttribute(
      'href',
      '/sat/mock',
    );
    expect(screen.getByRole('link', { name: 'Take a section test' })).toHaveAttribute(
      'href',
      '/sat/section',
    );
    expect(screen.getByRole('link', { name: 'Open the bank' })).toHaveAttribute(
      'href',
      '/sat/problems',
    );
    expect(screen.getByRole('button', { name: /Start a mixed set/ })).toBeEnabled();
  });

  it('call ACT sections categories', () => {
    render(ActPage());
    expect(screen.getByRole('heading', { level: 2, name: 'By category' })).toBeInTheDocument();
    for (const domain of actTaxonomy.domains) {
      expect(screen.getByRole('heading', { level: 3, name: domain.name })).toBeInTheDocument();
    }
  });

  it('have real metadata', () => {
    const meta = satHomeMetadata();
    expect(meta.title).toBe('SAT Math practice');
    expect(meta.alternates?.canonical).toBe('/sat');
  });
});

describe('/sat/problems', () => {
  it('is the shared bank with skills and difficulty but no level, and starts sets under /sat', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/sat/problems');
    const { container } = render(SatProblemsPage());
    await waitFor(() => expect(container.querySelector('[data-bank-loaded]')).not.toBeNull());
    const panel = screen.getByRole('complementary', { name: 'Filters' });
    expect(within(panel).queryAllByRole('radio')).toHaveLength(0);
    expect(within(panel).getByText('Skills')).toBeInTheDocument();
    for (const label of ['Easy', 'Medium', 'Hard']) {
      expect(within(panel).getByRole('checkbox', { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    const firstDomain = satTaxonomy.domains[0];
    if (!firstDomain) throw new Error('no SAT domain');
    await user.click(within(panel).getByRole('checkbox', { name: `All of ${firstDomain.name}` }));
    expect(window.location.search).toMatch(/^\?skill=/);
    const start = screen.getByRole('link', { name: /Start practice/ });
    expect(start.getAttribute('href')).toMatch(/^\/sat\/practice\?bank=sat&ids=SA-\d{4}/);
  });

  it('lists ACT questions under /act', async () => {
    window.history.replaceState(null, '', '/act/problems');
    const { container } = render(ActProblemsPage());
    await waitFor(() => expect(container.querySelector('[data-bank-loaded]')).not.toBeNull());
    expect(container.querySelector(`a[href="/act/problem/${firstAct.id}"]`)).not.toBeNull();
  });
});

describe('/sat/problem/[id] and /act/problem/[id]', () => {
  it('have one static page per problem, each in its own test', () => {
    expect(satProblemParams().map((p) => p.id)).toEqual(sat.map((p) => p.id));
    expect(actProblemParams().map((p) => p.id)).toEqual(act.map((p) => p.id));
  });

  it('name the skill in the title and never quote the statement in the description', async () => {
    const meta = await satProblemMetadata({ params: Promise.resolve({ id: firstSat.id }) });
    expect(String(meta.title)).toContain(firstSat.id);
    expect(meta.alternates?.canonical).toBe(`/sat/problem/${firstSat.id}`);
    expect(String(meta.description)).not.toContain('$');
    const wrongTest = await satProblemMetadata({ params: Promise.resolve({ id: firstAct.id }) });
    expect(wrongTest.robots).toEqual({ index: false });
    expect(() => TestProblemPage({ test: 'SAT', id: firstAct.id })).toThrow();
  });

  it('server-render the statement typeset, with four choices and a report link', async () => {
    const { container } = render(
      await SatProblemPage({ params: Promise.resolve({ id: firstSat.id }) }),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(firstSat.id);
    if (firstSat.statement.includes('$')) {
      expect(container.querySelector('.katex')).not.toBeNull();
    }
    const choices = screen.getByRole('group', { name: /answer choices/i });
    expect(within(choices).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Report an error in this question' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent(`content/tests/sat/problems/${firstSat.id}`)),
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('SAT Math');
    const structured = container.querySelector('script[type="application/ld+json"]');
    const correct = firstSat.choices.find((c) => c.correct);
    expect(structured?.textContent).not.toContain(correct?.text ?? '###');
  });

  it('record an attempt in the sat: bucket', async () => {
    const user = userEvent.setup();
    render(await SatProblemPage({ params: Promise.resolve({ id: firstSat.id }) }));
    const choices = screen.getByRole('group', { name: /answer choices/i });
    const first = within(choices).getAllByRole('button')[0];
    if (!first) throw new Error('no choice');
    await user.click(first);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const stored = JSON.parse(window.localStorage.getItem('ka-progress') ?? '{}') as {
      attempts?: Record<string, unknown[]>;
    };
    expect(stored.attempts?.[`sat:${firstSat.id}`]).toHaveLength(1);
  });

  it('render an ACT problem under the ACT test', async () => {
    render(await ActProblemPage({ params: Promise.resolve({ id: firstAct.id }) }));
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('ACT Math');
  });
});

describe('/sat/practice', () => {
  it('runs a SAT set from the query, with KaTeX', async () => {
    const ids = sat.slice(0, 3).map((p) => p.id);
    window.history.replaceState(null, '', `/sat/practice?bank=sat&ids=${ids.join(',')}`);
    render(SatPracticePage());
    expect((await screen.findAllByText(/Question 1 of 3/)).length).toBeGreaterThan(0);
  });
});

describe('/exams', () => {
  it('lists every exam with its way in, the past papers and progress', () => {
    render(ExamsPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Choose an exam' })).toBeInTheDocument();
    for (const name of ['Math Kangaroo', /^AMC 8/, /^AMC 10 and AMC 12/, 'SAT Math', 'ACT Math']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Practice SAT Math' })).toHaveAttribute('href', '/sat');
    expect(screen.getByRole('link', { name: 'Practice ACT Math' })).toHaveAttribute('href', '/act');
    expect(screen.getByRole('link', { name: 'Practice AMC 8' })).toHaveAttribute('href', '/amc');
    expect(screen.getByRole('link', { name: 'Math Kangaroo: Past papers' })).toHaveAttribute(
      'href',
      '/papers',
    );
    expect(screen.getByRole('link', { name: 'See my progress' })).toHaveAttribute(
      'href',
      '/progress',
    );
    const satCard = screen.getByRole('heading', { level: 2, name: 'SAT Math' }).closest('article');
    expect(satCard).toHaveTextContent(`${sat.length} problems`);
  });
});

describe('the home page', () => {
  it('points first-time visitors to the other exams', () => {
    pathname.current = '/';
    render(HomePage());
    expect(screen.getByRole('link', { name: /Other exams/ })).toHaveAttribute('href', '/exams');
  });
});

describe('the sitemap', () => {
  it('lists the exams hub, the SAT and ACT pages and every question, not the practice runners', () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const path of ['/exams', '/sat', '/sat/problems', '/act', '/act/problems']) {
      expect(urls.has(`${SITE.url}${path}`), path).toBe(true);
    }
    for (const problem of sat) expect(urls.has(`${SITE.url}/sat/problem/${problem.id}`)).toBe(true);
    for (const problem of act) expect(urls.has(`${SITE.url}/act/problem/${problem.id}`)).toBe(true);
    expect(urls.has(`${SITE.url}/sat/practice`)).toBe(false);
    expect(urls.has(`${SITE.url}/act/practice`)).toBe(false);
  });
});
