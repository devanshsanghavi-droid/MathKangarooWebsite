import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import { ProblemCard } from '../ProblemCard';
import { getAllProblems, getProblem } from '@/lib/content';
import type { Problem } from '@/lib/schemas';

function problemOrThrow(id: string): Problem {
  const problem = getProblem(id);
  if (!problem) throw new Error(`${id} is missing from content/`);
  return problem;
}

describe('a problem, rendered', () => {
  it('has no axe violations in either theme', async () => {
    const { container } = render(<ProblemCard problem={problemOrThrow('KA-0001')} />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations after a wrong answer opens the feedback panel', async () => {
    const problem = problemOrThrow('KA-0001');
    const { container } = render(<ProblemCard problem={problem} />);
    const wrong = problem.choices.find((c) => !c.correct);
    if (!wrong) throw new Error('malformed fixture');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${wrong.key}`) }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with every hint and both solution tabs open', async () => {
    const problem = problemOrThrow('KA-0001');
    const { container } = render(<ProblemCard problem={problem} />);
    await userEvent.click(screen.getByText(/a nudge/i));
    await userEvent.click(screen.getByText(/the strategy/i));
    await userEvent.click(screen.getByText(/the full solution/i));
    await userEvent.click(screen.getByText(/^Solution/));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations for a problem without a figure', async () => {
    const noFigure = getAllProblems().find((p) => p.figure === null);
    if (!noFigure) throw new Error('the bank has no figure-free problem');
    const { container } = render(<ProblemCard problem={noFigure} />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations for any figure in the bank', async () => {
    const withFigures = getAllProblems().filter((p) => p.figure !== null);
    expect(withFigures.length).toBeGreaterThan(0);
    for (const problem of withFigures) {
      const { container, unmount } = render(<ProblemCard problem={problem} />);
      expect(await auditBothThemes(container), problem.id).toEqual([]);
      unmount();
    }
  });
});
