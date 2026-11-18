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

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
});

afterEach(() => {
  document.cookie = `${HINT_COOKIE_NAME}=; max-age=0; path=/`;
});

describe('/progress with nothing answered', () => {
  it('has one h1 and points to a first practice set', () => {
    render(<ProgressPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a practice set' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('tablist')).toBeNull();
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

  it('opens on Kangaroo and disables the banks with nothing in them', () => {
    render(<ProgressPage />);
    const tabs = within(screen.getByRole('tablist', { name: 'Question bank' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringContaining('Kangaroo'),
      expect.stringContaining('AMC'),
      expect.stringContaining('SAT'),
      expect.stringContaining('ACT'),
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).not.toHaveAttribute('aria-disabled');
    expect(tabs[2]).toHaveAttribute('aria-disabled', 'true');
    expect(tabs[3]).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows accuracy by strand as named bars with numbers', () => {
    render(<ProgressPage />);
    const strand = kaProblems[0]?.skills.primary.slice(0, 3);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(bars.some((bar) => bar.getAttribute('aria-valuetext') === '2 of 6 right')).toBe(true);
    expect(screen.getByRole('heading', { name: 'By strand' })).toBeInTheDocument();
    expect(strand).toBeTruthy();
  });

  it('lists the weak strand with a link into its section test', () => {
    render(<ProgressPage />);
    const first = kaProblems[0];
    const link = screen.getByRole('link', { name: /Practice this/ });
    expect(link).toHaveAttribute(
      'href',
      `/practice/section?level=${first?.band}&strand=${first?.skills.primary.slice(0, 3)}`,
    );
  });

  it('draws both weekly charts with a data table behind them', () => {
    render(<ProgressPage />);
    expect(screen.getByRole('img', { name: /Weekly accuracy/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Questions answered each week/ })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /Week by week/ });
    expect(within(table).getAllByRole('row')).toHaveLength(13); // header + 12 weeks
  });

  it('lists the finished section test', () => {
    render(<ProgressPage />);
    const table = screen.getByRole('table', { name: /Finished tests/ });
    expect(within(table).getByText(/Kangaroo section test/)).toBeInTheDocument();
    // Score and right answers: 6 of 10 on a section test is both.
    expect(within(table).getAllByText('6 / 10', { selector: 'td.mono' })).toHaveLength(2);
  });

  it('moves between enabled tabs with the arrow keys, skipping disabled ones', async () => {
    render(<ProgressPage />);
    const tabs = screen.getAllByRole('tab');
    tabs[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'By area' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ignores a click on a disabled tab', async () => {
    render(<ProgressPage />);
    const tabs = screen.getAllByRole('tab');
    await userEvent.click(tabs[2] as HTMLElement);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('never shows a streak, a badge or a rank', () => {
    const { container } = render(<ProgressPage />);
    expect(container.textContent).not.toMatch(/streak|badge|leaderboard|rank/i);
  });
});
