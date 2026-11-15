import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import ProblemsPage from '../problems/page';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

async function renderBank(path: string) {
  window.history.replaceState(null, '', path);
  const utils = render(ProblemsPage());
  await waitFor(() => expect(utils.container.querySelector('[data-bank-loaded]')).not.toBeNull());
  return utils;
}

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
  installStaticDataFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the question bank', () => {
  it.each([
    ['unfiltered', '/problems'],
    ['filtered', '/problems?level=5-6&points=4'],
    ['paginated', '/problems?page=2'],
    ['empty', '/problems?level=1-2&points=5&figure=1&status=solved'],
    ['with skills ticked', '/problems?skill=CNT-01,CNT-12'],
  ])('has no axe violations when %s, in either theme', async (_label, path) => {
    const { container } = await renderBank(path);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with a strand open and the mobile filter sheet showing', async () => {
    const user = userEvent.setup();
    const { container } = await renderBank('/problems');
    const panel = screen.getByRole('complementary', { name: 'Filters' });
    await user.click(within(panel).getByRole('button', { name: /Geometry/ }));
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
