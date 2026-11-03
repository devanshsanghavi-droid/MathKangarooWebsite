import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemInteractive } from '../ProblemInteractive';
import { getAllProblems } from '@/lib/content';
import { readProgress } from '@/lib/local-progress';
import { statusOfProblem } from '@/lib/progress-summary';

/**
 * Solving from the bank has to count. The table's status column and the progress strip both
 * read localStorage, and before this the problem page never wrote to it, so a student could
 * solve the whole bank from /problems and see "Not started" on every row.
 */
function setup() {
  const problem = getAllProblems()[0];
  const right = problem?.choices.find((c) => c.correct);
  const wrong = problem?.choices.find((c) => !c.correct);
  if (!problem || !right || !wrong) throw new Error('the bank is empty or malformed');
  return { problem, right, wrong, skillIds: [problem.skills.primary, ...problem.skills.secondary] };
}
const { problem, right, wrong, skillIds } = setup();

beforeEach(() => window.localStorage.clear());

async function pick(key: string) {
  const group = screen.getByRole('group', { name: /answer choices/i });
  const button = within(group)
    .getAllByRole('button')
    .find((b) => b.textContent?.trim().startsWith(key));
  if (!button) throw new Error(`no choice ${key}`);
  await userEvent.click(button);
}

describe('answering on the problem page', () => {
  it('records a right first answer as solved first try', async () => {
    render(<ProblemInteractive problem={problem} />);
    await pick(right.key);
    expect(statusOfProblem(readProgress(), problem.id, skillIds)).toBe('mastered');
  });

  it('records only the first pick, so changing an answer cannot farm a correct one', async () => {
    render(<ProblemInteractive problem={problem} />);
    await pick(wrong.key);
    await pick(right.key);
    expect(statusOfProblem(readProgress(), problem.id, skillIds)).toBe('seen');
  });
});
