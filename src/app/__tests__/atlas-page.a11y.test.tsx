import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import AtlasPage from '../atlas/page';
import StrandPage from '../atlas/[strand]/page';
import type { RawSearchParams } from '@/lib/atlas-params';

async function renderAtlas(searchParams: RawSearchParams = {}) {
  return render(await AtlasPage({ searchParams: Promise.resolve(searchParams) }));
}

describe('the Atlas', () => {
  it('has no axe violations in the graph view, in either theme', async () => {
    const { container } = await renderAtlas({});
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations in the list view, in either theme', async () => {
    const { container } = await renderAtlas({ view: 'list' });
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with a skill focused', async () => {
    const { container } = await renderAtlas({ focus: 'CNT-12' });
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations in the empty state', async () => {
    const { container } = await renderAtlas({ strand: 'PAT', band: '11-12', points: '5' });
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations on a strand walkthrough', async () => {
    const { container } = render(await StrandPage({ params: Promise.resolve({ strand: 'GEO' }) }));
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
