import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import ProblemsPage from '../problems/page';
import type { RawSearchParams } from '@/lib/problem-query';

async function renderProblems(searchParams: RawSearchParams = {}) {
  return render(await ProblemsPage({ searchParams: Promise.resolve(searchParams) }));
}

describe('the browse page', () => {
  it.each([
    ['unfiltered', {}],
    ['filtered', { band: '5-6', points: '4' }],
    ['paginated', { page: '2' }],
    ['empty', { band: '11-12' }],
    ['sorted by difficulty', { sort: 'difficulty' }],
  ])('has no axe violations when %s, in either theme', async (_label, params) => {
    const { container } = await renderProblems(params as RawSearchParams);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
