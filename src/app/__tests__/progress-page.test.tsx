import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProgressPage from '../progress/page';
import { getAllProblems } from '@/lib/content';
import { PROGRESS_KEY, type ProgressFile } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { HINT_COOKIE_NAME } from '@/lib/signed-in-hint';
import { seededProgress } from '../../../test/progress-fixture';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => '/progress' };
});

const kaProblems = getAllProblems();

function seed(file: ProgressFile) {
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(file));
  resetProgressCache();
}

function visit(search = '') {
  window.history.replaceState(null, '', `/progress${search}`);
}

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  visit();
});

afterEach(() => {
  document.cookie = `${HINT_COOKIE_NAME}=; max-age=0; path=/`;
});

describe('/progress with nothing answered', () => {
  it('has one h1 and points to a first practice set and the demo', () => {
    render(<ProgressPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a practice set' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'See a demo student' })).toHaveAttribute(
      'href',
      '/progress?demo=1',
    );
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('nudges, gently, towards signing in', () => {
    render(<ProgressPage />);
    expect(
      screen.getByRole('link', { name: 'Sign in to keep this on every device' }),
    ).toHaveAttribute('href', '/login');
  });

  it('says it is synced instead when the browser is signed in', () => {
    document.cookie = `${HINT_COOKIE_NAME}=1; path=/`;
    render(<ProgressPage />);
    expect(screen.getByText(/Synced with your account/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sign in/ })).toBeNull();
  });
});

describe('/progress with answers', () => {
  beforeEach(() => seed(seededProgress()));

  it('opens on all exams and disables the exams with nothing in them', () => {
    render(<ProgressPage />);
    const radios = within(screen.getByRole('radiogroup', { name: 'Exam' })).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      expect.stringContaining('All exams'),
      expect.stringContaining('Kangaroo'),
      expect.stringContaining('AMC 8'),
      expect.stringContaining('AMC 10'),
      expect.stringContaining('AMC 12'),
      expect.stringContaining('SAT'),
      expect.stringContaining('ACT'),
    ]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).not.toHaveAttribute('aria-disabled');
    expect(radios[5]).toHaveAttribute('aria-disabled', 'true');
    expect(radios[6]).toHaveAttribute('aria-disabled', 'true');
  });

  it('opens with a plain-language summary and the key stats', () => {
    render(<ProgressPage />);
    expect(screen.getByRole('heading', { name: /In short/ })).toBeInTheDocument();
    expect(screen.getByText(/You have finished 1 test; after 4/)).toBeInTheDocument();
    expect(screen.getByText(/Focus next on .+ in Kangaroo \(33%\)/)).toBeInTheDocument();
    expect(screen.getByText('Tests taken')).toBeInTheDocument();
    expect(screen.getByText('not tracked yet')).toBeInTheDocument();
  });

  it('tags the weak strand in words and links to its section test', () => {
    render(<ProgressPage />);
    const first = kaProblems[0];
    const table = screen.getByRole('table', { name: /Topics, weakest first/ });
    expect(within(table).getByText('Needs work')).toBeInTheDocument();
    const links = within(table).getAllByRole('link', { name: /Practice/ });
    expect(links[0]).toHaveAttribute(
      'href',
      `/practice/section?level=${first?.band}&strand=${first?.skills.primary.slice(0, 3)}`,
    );
  });

  it('draws every chart with a text or table alternative', () => {
    render(<ProgressPage />);
    expect(screen.getByRole('img', { name: /Test scores as a share/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Weekly accuracy, last 8 weeks/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Questions answered each week/ })).toBeInTheDocument();
    const weeks = screen.getByRole('table', { name: /Week by week/ });
    expect(within(weeks).getAllByRole('row')).toHaveLength(9); // header + 8 weeks
    expect(screen.getByText(/Active on \d+ of the last \d+ days/)).toBeInTheDocument();
    const activity = screen.getByRole('table', { name: /Activity week by week/ });
    expect(within(activity).getAllByRole('row')).toHaveLength(13);
    expect(screen.getByRole('table', { name: /Test scores, oldest first/ })).toBeInTheDocument();
  });

  it('lists the finished section test, offering a fresh one when its questions are unknown', () => {
    render(<ProgressPage />);
    const table = screen.getByRole('table', { name: /Finished tests/ });
    expect(within(table).getAllByText(/Kangaroo section test/)[0]).toBeInTheDocument();
    expect(within(table).getAllByText('6 / 10')).toHaveLength(2);
    const strand = kaProblems[0]?.skills.primary.slice(0, 3);
    expect(within(table).getByRole('link', { name: /Take again/ })).toHaveAttribute(
      'href',
      `/practice/section?strand=${strand}`,
    );
  });

  it('filters to one exam, mirrors it to the URL and shows the strand detail', async () => {
    render(<ProgressPage />);
    expect(screen.queryByRole('heading', { name: 'By strand' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /Kangaroo/ }));
    expect(window.location.search).toBe('?exam=ka');
    expect(screen.getByRole('radio', { name: /Kangaroo/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { name: 'By strand' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Take a Kangaroo mock' })).toHaveAttribute(
      'href',
      '/practice/mock',
    );
    await userEvent.click(screen.getByRole('radio', { name: /All exams/ }));
    expect(window.location.search).toBe('');
  });

  it('reads the filter from the URL, and ignores an exam with nothing in it', () => {
    visit('?exam=ka');
    const { unmount } = render(<ProgressPage />);
    expect(screen.getByRole('radio', { name: /Kangaroo/ })).toHaveAttribute('aria-checked', 'true');
    unmount();
    visit('?exam=sat');
    render(<ProgressPage />);
    expect(screen.getByRole('radio', { name: /All exams/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('moves between enabled exams with the arrow keys, skipping disabled ones', async () => {
    render(<ProgressPage />);
    const radios = screen.getAllByRole('radio');
    radios[0]?.focus();
    await userEvent.keyboard('{End}');
    const last = radios.filter((r) => !r.hasAttribute('aria-disabled')).at(-1);
    expect(last).toHaveAttribute('aria-checked', 'true');
    expect(last).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('ignores a click on a disabled exam', async () => {
    render(<ProgressPage />);
    await userEvent.click(screen.getByRole('radio', { name: /SAT/ }));
    expect(screen.getByRole('radio', { name: /All exams/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('never shows a streak, a badge or a rank', () => {
    const { container } = render(<ProgressPage />);
    expect(container.textContent).not.toMatch(/streak|badge|leaderboard|rank/i);
  });
});

describe('/progress?demo=1', () => {
  it('shows the sample student with a banner and an exit, and never touches storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    visit('?demo=1');
    render(<ProgressPage />);
    expect(screen.getByText('Demo data: this is a sample student.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exit the demo' })).toHaveAttribute(
      'href',
      '/progress',
    );
    expect(screen.queryByRole('link', { name: /Sign in/ })).toBeNull();
    // Three exams with answers, the rest disabled.
    expect(screen.getByRole('radio', { name: /AMC 10/ })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('radio', { name: /SAT/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Test scores have risen/)).toBeInTheDocument();
    const history = screen.getByRole('table', { name: /Finished tests/ });
    const reviews = within(history).getAllByRole('link', { name: /^Review/ });
    expect(reviews.length).toBeGreaterThanOrEqual(5);
    expect(reviews[0]?.getAttribute('href')).toMatch(/^\/(amc\/)?practice(\/set)?\?.*ids=/);
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
    setItem.mockRestore();
  });

  it('keeps demo=1 in the URL when the filter changes', async () => {
    visit('?demo=1');
    render(<ProgressPage />);
    await userEvent.click(screen.getByRole('radio', { name: /AMC 8/ }));
    expect(new URLSearchParams(window.location.search).get('demo')).toBe('1');
    expect(new URLSearchParams(window.location.search).get('exam')).toBe('amc8');
    expect(screen.getByText('Demo data: this is a sample student.')).toBeInTheDocument();
  });
});
