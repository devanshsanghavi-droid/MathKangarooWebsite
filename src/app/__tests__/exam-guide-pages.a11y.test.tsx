import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import ExamPage from '../exams/[id]/page';
import TestsPage from '../exams/tests/page';
import { PROGRESS_KEY, type ProgressFile } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';

/*
 * axe against the exam pages (docs/08 item 3) and the tests hub (item 13), in both themes:
 * a live exam with and without saved scores, Kangaroo with its level picker, and a
 * coming-soon exam. The catalog (/exams) is audited in exam-pages.a11y.test.tsx.
 */

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => '/exams' };
});

const page = async (id: string) => render(await ExamPage({ params: Promise.resolve({ id }) }));

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('the exam pages', () => {
  it('/exams/amc10 with no progress has no axe violations', async () => {
    const { container } = await page('amc10');
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/exams/sat with saved scores, chart and table open, has no axe violations', async () => {
    const file: ProgressFile = {
      version: 1,
      attempts: {},
      sessions: [
        {
          kind: 'mock',
          exam: 'SAT',
          at: '2026-10-01T10:00:00.000Z',
          score: 30,
          max: 44,
          correct: 30,
          total: 44,
          durationMs: 1,
        },
        {
          kind: 'section',
          exam: 'SAT',
          section: 'ALG',
          at: '2026-10-08T10:00:00.000Z',
          score: 7,
          max: 10,
          correct: 7,
          total: 10,
          durationMs: 1,
        },
      ],
    };
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(file));
    resetProgressCache();
    const { container, getByText } = await page('sat');
    await userEvent.click(getByText('Show the scores as a table'));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/exams/ka with a level chosen has no axe violations', async () => {
    window.history.replaceState(null, '', '/exams/ka');
    const { container, getByRole } = await page('ka');
    await userEvent.click(getByRole('button', { name: /Level 5-6/ }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/exams/mathcounts (coming soon) has no axe violations', async () => {
    const { container } = await page('mathcounts');
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/exams/tests has no axe violations', async () => {
    const { container } = render(TestsPage());
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
