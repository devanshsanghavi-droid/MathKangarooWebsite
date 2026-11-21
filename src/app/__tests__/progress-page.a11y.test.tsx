import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import ProgressPage from '../progress/page';
import { PROGRESS_KEY } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { seededProgress } from '../../../test/progress-fixture';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => '/progress' };
});

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  window.history.replaceState(null, '', '/progress');
});

describe('/progress accessibility', () => {
  it('has no axe violations when empty, in either theme', async () => {
    const { container } = render(<ProgressPage />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with answers and a test history, in either theme', async () => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(seededProgress()));
    resetProgressCache();
    const { container } = render(<ProgressPage />);
    expect(screen.getByRole('radiogroup', { name: 'Exam' })).toBeInTheDocument();
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations on one exam with a section opened', async () => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(seededProgress()));
    resetProgressCache();
    const { container } = render(<ProgressPage />);
    await userEvent.click(screen.getByRole('radio', { name: /Kangaroo/ }));
    const summary = container.querySelector('summary');
    if (summary) await userEvent.click(summary);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations for the demo student, in either theme', async () => {
    window.history.replaceState(null, '', '/progress?demo=1');
    const { container } = render(<ProgressPage />);
    expect(screen.getByText('Demo data: this is a sample student.')).toBeInTheDocument();
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
