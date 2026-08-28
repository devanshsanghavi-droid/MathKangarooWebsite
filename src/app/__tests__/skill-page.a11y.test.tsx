import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import SkillPage from '../skill/[id]/page';
import { getAllSkills, getProblemsForSkill } from '@/lib/content';

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

  it('has no axe violations for a skill with no problems at all', async () => {
    const empty = getAllSkills().find((s) => getProblemsForSkill(s.id).length === 0);
    if (!empty) throw new Error('every skill has problems, so this case cannot be exercised');
    const { container } = await renderSkill(empty.id);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
