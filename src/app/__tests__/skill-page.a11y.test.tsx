import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import SkillPage from '../skill/[id]/page';
import type * as contentModule from '@/lib/content';

type ContentModule = typeof contentModule;

async function renderSkill(id: string) {
  return render(await SkillPage({ params: Promise.resolve({ id }) }));
}

/** A sample that covers each shape the page can take, rather than all 91 every run. */
const SAMPLE = [
  'CNT-12', // three problems, prerequisites and unlocks
  'NUM-01', // a root skill: no prerequisites
  'CFT-12', // a gateway skill at the end of a chain
  'GEO-10', // has a figure in its worked example
];

describe('the skill page', () => {
  it.each(SAMPLE)('%s has no axe violations in either theme', async (id) => {
    const { container } = await renderSkill(id);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with every section in its empty state', async () => {
    // No skill is uncovered any more, so the empty branches are exercised against a stubbed
    // one. They still ship: a newly added skill has no problems on the day it lands.
    vi.resetModules();
    vi.doMock('@/lib/content', async () => {
      const actual = (await vi.importActual('@/lib/content')) as ContentModule;
      const skill = actual.getSkill('GEO-17');
      if (!skill) throw new Error('GEO-17 is missing');
      return {
        ...actual,
        getSkill: (id: string) =>
          id === 'GEO-17' ? { ...skill, canonicalProblem: null } : actual.getSkill(id),
        getProblemsForSkill: (id: string) =>
          id === 'GEO-17' ? [] : actual.getProblemsForSkill(id),
        getPapersForSkill: () => [],
      };
    });

    const EmptyPage = (await import('../skill/[id]/page')).default;
    const { container } = render(await EmptyPage({ params: Promise.resolve({ id: 'GEO-17' }) }));
    expect(await auditBothThemes(container)).toEqual([]);

    vi.doUnmock('@/lib/content');
    vi.resetModules();
  });
});
