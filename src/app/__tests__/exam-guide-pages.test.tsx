import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExamPage, {
  generateMetadata as examMetadata,
  generateStaticParams as examParams,
} from '../exams/[id]/page';
import TestsPage from '../exams/tests/page';
import AmcPage from '../amc/page';
import SatPage from '../sat/page';
import { EXAMS, examById } from '@/lib/exams';
import { PROGRESS_KEY, type ProgressFile } from '@/lib/local-progress';
import { getAmcProblemsFor, getAmcTaxonomy } from '@/lib/amc-content';
import { getAllProblems } from '@/lib/content';
import { getAllTestProblems } from '@/lib/test-content';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { ExamScoreChart } from '@/components/exams/ExamScoreChart';
import { ExamTopics } from '@/components/exams/ExamTopics';
import { examPageData } from '@/components/exams/exam-page-data';

/* The exam pages (docs/08 item 3), the tests hub (item 13) and the area-home links to them. */

const pathname = vi.hoisted(() => ({ current: '/exams/amc10' }));
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => pathname.current };
});
vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const page = async (id: string) => render(await ExamPage({ params: Promise.resolve({ id }) }));

function store(file: ProgressFile): void {
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(file));
  resetProgressCache();
}

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  window.history.replaceState(null, '', '/exams/amc10');
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('/exams/[id] routing', () => {
  it('prerenders every catalog exam, live and coming soon', () => {
    expect(examParams().map((p) => p.id)).toEqual(EXAMS.map((exam) => exam.id));
  });

  it('gives each a real title and canonical', async () => {
    const meta = await examMetadata({ params: Promise.resolve({ id: 'amc10' }) });
    expect(meta.title).toBe('AMC 10: format, scoring and tips');
    expect(meta.alternates?.canonical).toBe('/exams/amc10');
    const soon = await examMetadata({ params: Promise.resolve({ id: 'psat' }) });
    expect(String(soon.title)).toContain('coming soon');
  });
});

describe('a live exam page', () => {
  it('shows the format, scoring, tips and the four ways in', async () => {
    await page('amc10');
    const exam = examById('amc10');
    expect(screen.getByRole('heading', { level: 1, name: 'AMC 10' })).toBeInTheDocument();
    const format = screen.getByRole('region', { name: 'Format and scoring' });
    expect(format).toHaveTextContent('Not allowed');
    expect(format).toHaveTextContent(exam?.scoring.summary ?? '');
    expect(format).toHaveTextContent(exam?.eligibility ?? '');
    const tips = screen.getByRole('region', { name: 'Test-day tips' });
    expect(within(tips).getAllByRole('listitem')).toHaveLength(exam?.tips.length ?? 0);
    expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '/amc');
    expect(screen.getByRole('link', { name: 'Mock test' })).toHaveAttribute(
      'href',
      '/amc/mock?contest=AMC10',
    );
    expect(screen.getByRole('link', { name: 'Question bank' })).toHaveAttribute(
      'href',
      '/amc/problems?level=AMC10',
    );
    expect(screen.getByRole('link', { name: 'Learn: formula sheet' })).toHaveAttribute(
      'href',
      '/amc/formulas',
    );
  });

  it("lists the AMC areas with that paper's question counts", async () => {
    await page('amc10');
    const topics = screen.getByRole('region', { name: 'Topics' });
    const problems = getAmcProblemsFor('AMC10');
    for (const area of getAmcTaxonomy().areas) {
      const count = problems.filter((p) => p.area === area.id).length;
      if (count === 0) continue;
      const row = within(topics).getByRole('rowheader', { name: area.name }).closest('tr');
      expect(row).toHaveTextContent(String(count));
      expect(row).toHaveTextContent('Not tried yet');
    }
  });

  it("uses the exam's own topic names", async () => {
    await page('sat');
    expect(screen.getByRole('rowheader', { name: 'Problem solving and data' })).toBeInTheDocument();
    // SAT and ACT: Practice is the area home, so a separate Learn button would repeat it.
    expect(screen.queryByRole('link', { name: /^Learn/ })).toBeNull();
  });

  it("shows the student's accuracy per topic from this browser", async () => {
    const problem = getAmcProblemsFor('AMC10')[0];
    if (!problem) throw new Error('needs AMC 10 content');
    const at = new Date().toISOString();
    store({
      version: 1,
      attempts: {
        [problem.id]: [
          { problemId: problem.id, points: 3, correct: true, hintsUsed: 0, at },
          {
            problemId: problem.id,
            points: 3,
            correct: false,
            hintsUsed: 0,
            at: new Date(Date.now() + 1000).toISOString(),
          },
        ],
      },
    });
    await page('amc10');
    const areaName = getAmcTaxonomy().areas.find((a) => a.id === problem.area)?.name ?? '';
    const row = screen.getByRole('rowheader', { name: areaName }).closest('tr');
    expect(row).toHaveTextContent('50%');
    expect(row).toHaveTextContent('1 of 2 right');
  });

  it('links the related exam and the catalog', async () => {
    await page('amc10');
    expect(screen.getByRole('link', { name: 'AMC 12' })).toHaveAttribute('href', '/exams/amc12');
    expect(screen.getByRole('link', { name: 'Every exam' })).toHaveAttribute('href', '/exams');
  });
});

describe('the score chart', () => {
  it('shows an empty state with a way to a mock when there are no tests', async () => {
    await page('act');
    const scores = screen.getByRole('region', { name: 'Your scores' });
    expect(scores).toHaveTextContent('No tests yet');
    expect(within(scores).getByRole('link', { name: 'mock test' })).toHaveAttribute(
      'href',
      '/act/mock',
    );
  });

  it("draws only this exam's sessions, with a text alternative", () => {
    const file: ProgressFile = {
      version: 1,
      attempts: {},
      sessions: [
        {
          kind: 'mock',
          exam: 'SAT',
          at: '2026-10-01T10:00:00.000Z',
          score: 22,
          max: 44,
          correct: 22,
          total: 44,
          durationMs: 1,
        },
        {
          kind: 'section',
          exam: 'SAT',
          section: 'ALG',
          at: '2026-10-08T10:00:00.000Z',
          score: 8,
          max: 10,
          correct: 8,
          total: 10,
          durationMs: 1,
        },
        {
          kind: 'mock',
          exam: 'ACT',
          at: '2026-10-09T10:00:00.000Z',
          score: 40,
          max: 45,
          correct: 40,
          total: 45,
          durationMs: 1,
        },
        {
          kind: 'mock',
          exam: 'SAT',
          at: '2026-10-15T10:00:00.000Z',
          score: 33,
          max: 44,
          correct: 33,
          total: 44,
          durationMs: 1,
        },
      ],
    };
    const { container } = render(
      <ExamScoreChart examId="sat" sectionNames={{ ALG: 'Algebra' }} file={file} />,
    );
    const chart = screen.getByRole('img');
    expect(chart.getAttribute('aria-label')).toContain('3 tests');
    expect(chart.getAttribute('aria-label')).toContain('from 50% to 75%');
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    expect(container.querySelectorAll('svg rect')).toHaveLength(1);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('33 of 44 (75%)');
    expect(rows[2]).toHaveTextContent('Section test: Algebra');
  });
});

describe('the Kangaroo page', () => {
  it('switches the format, links and topics with the level, mirroring it in the URL', async () => {
    window.history.replaceState(null, '', '/exams/ka');
    await page('ka');
    const level12 = screen.getByRole('button', { name: /Level 1-2/ });
    expect(level12).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: /Format: Level 1-2/ })).toHaveTextContent('24');

    await userEvent.click(screen.getByRole('button', { name: /Level 9-10/ }));
    expect(screen.getByRole('button', { name: /Level 9-10/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(window.location.search).toBe('?level=9-10');
    const format = screen.getByRole('region', { name: /Format: Level 9-10/ });
    expect(format).toHaveTextContent('30');
    expect(screen.getByRole('link', { name: 'Question bank' })).toHaveAttribute(
      'href',
      '/problems?level=9-10',
    );
    expect(screen.getByRole('link', { name: 'Section tests' })).toHaveAttribute(
      'href',
      '/practice/section?level=9-10',
    );
    const inLevel = getAllProblems().filter((p) => p.band === '9-10').length;
    expect(format).toHaveTextContent(`${inLevel.toLocaleString('en-US')} questions`);
  });

  it('opens on the level in the URL', async () => {
    window.history.replaceState(null, '', '/exams/ka?level=7-8');
    await page('ka');
    expect(await screen.findByRole('region', { name: /Format: Level 7-8/ })).toBeInTheDocument();
  });

  it('counts strands per level from the content', () => {
    const exam = examById('ka');
    if (!exam) throw new Error('needs Kangaroo');
    const data = examPageData(exam);
    for (const track of exam.tracks) {
      const sum = (data.byTrack[track.id] ?? []).reduce((n, row) => n + row.count, 0);
      expect(sum, track.id).toBe(data.totalByTrack[track.id]);
    }
    expect(data.total).toBe(getAllProblems().length);
  });

  it('counts only answers on the chosen level towards its accuracy', () => {
    const exam = examById('ka');
    const first = getAllProblems()[0];
    if (!exam || !first) throw new Error('needs Kangaroo');
    const data = examPageData(exam);
    const file: ProgressFile = {
      version: 1,
      attempts: {
        [first.skills.primary]: [
          {
            problemId: first.id,
            points: first.points,
            correct: true,
            hintsUsed: 0,
            at: '2026-11-01T00:00:00.000Z',
          },
        ],
      },
    };
    const other = exam.tracks.find((t) => t.id !== first.band)?.id ?? null;
    const { unmount } = render(
      <ExamTopics
        rows={data.byTrack[first.band] ?? []}
        spec={data.spec}
        noun="Strand"
        level={first.band}
        file={file}
      />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
    unmount();
    render(
      <ExamTopics
        rows={data.byTrack[other ?? ''] ?? []}
        spec={data.spec}
        noun="Strand"
        level={other}
        file={file}
      />,
    );
    expect(screen.queryByText('100%')).toBeNull();
  });
});

describe('a coming-soon exam page', () => {
  it('shows the format, a Coming soon label and a prominent link to the related exam', async () => {
    await page('aime');
    expect(screen.getByRole('heading', { level: 1, name: 'AIME' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    const meanwhile = screen.getByRole('region', { name: 'Practise for AMC 12 meanwhile' });
    expect(within(meanwhile).getByRole('link', { name: 'Go to AMC 12' })).toHaveAttribute(
      'href',
      '/exams/amc12',
    );
    expect(screen.getByRole('region', { name: 'Format' })).toHaveTextContent('Typed, no choices');
    expect(screen.queryByRole('link', { name: 'Mock test' })).toBeNull();
  });
});

describe('/exams/tests', () => {
  it('lists the mock and section test of every live exam', () => {
    render(TestsPage());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mock and section tests' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Math Kangaroo mock test' })).toHaveAttribute(
      'href',
      '/practice/mock',
    );
    expect(screen.getByRole('link', { name: 'AMC 8 mock test' })).toHaveAttribute(
      'href',
      '/amc/mock?contest=AMC8',
    );
    expect(screen.getByRole('link', { name: 'SAT Math section test' })).toHaveAttribute(
      'href',
      '/sat/section',
    );
    expect(screen.getByRole('link', { name: 'ACT Math format and tips' })).toHaveAttribute(
      'href',
      '/exams/act',
    );
    expect(screen.getAllByRole('article')).toHaveLength(6);
  });
});

describe('the area homes', () => {
  it('/amc links each AMC exam page', () => {
    pathname.current = '/amc';
    render(AmcPage());
    for (const id of ['amc8', 'amc10', 'amc12']) {
      const exam = examById(id);
      expect(
        screen.getByRole('link', { name: `${exam?.name ?? ''} format and tips` }),
      ).toHaveAttribute('href', `/exams/${id}`);
    }
  });

  it('/sat links the SAT exam page', () => {
    pathname.current = '/sat';
    expect(getAllTestProblems('SAT').length).toBeGreaterThan(0);
    render(SatPage());
    expect(screen.getByRole('link', { name: 'Format and tips' })).toHaveAttribute(
      'href',
      '/exams/sat',
    );
  });
});
