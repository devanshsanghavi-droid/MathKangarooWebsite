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
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations on a second bank with a section opened', async () => {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(seededProgress()));
    resetProgressCache();
    const { container } = render(<ProgressPage />);
    await userEvent.click(screen.getByRole('tab', { name: /AMC/ }));
    const summary = container.querySelector('summary');
    if (summary) await userEvent.click(summary);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
