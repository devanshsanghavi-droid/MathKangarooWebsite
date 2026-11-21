import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import { GradeMap } from '../GradeMap';
import { InlinePotd } from '../InlinePotd';
import { getAllProblems, getSkill } from '@/lib/content';
import { kaPracticeItem } from '@/lib/practice-item';
import { dayNumber } from '@/lib/potd';
import { resetProgressCache } from '@/components/mastery/useProgress';

describe('home components', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetProgressCache();
  });

  it('the grade map has no axe violations with and without a grade chosen', async () => {
    const { container } = render(<GradeMap />);
    expect(await auditBothThemes(container)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Grade 10' }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('the puzzle of the day has no axe violations after a wrong answer', async () => {
    const problem = getAllProblems().find((p) => p.figure === null);
    const wrong = problem?.choices.find((c) => !c.correct);
    if (!problem || !wrong) throw new Error('bad fixture');
    const { container } = render(
      <InlinePotd
        picks={[{ item: kaPracticeItem(problem, (id) => getSkill(id)?.name), skillName: null }]}
        startDay={dayNumber(new Date())}
      />,
    );
    await userEvent.click(document.getElementById(`potd-${problem.id}-${wrong.key}`) as Element);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
