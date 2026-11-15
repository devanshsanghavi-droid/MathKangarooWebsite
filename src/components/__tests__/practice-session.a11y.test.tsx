import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import { PracticeSession } from '../practice-session';
import { getAllProblems, getSkill } from '@/lib/content';
import { kaPracticeItem, type KaPracticeItem } from '@/lib/practice-item';

vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

// One with a figure, so the figure path is audited too.
const problems = getAllProblems();
const withFigure = problems.find((problem) => problem.figure !== null);
const items: KaPracticeItem[] = [
  ...(withFigure ? [withFigure] : []),
  ...problems.filter((problem) => problem !== withFigure).slice(0, 2),
].map((problem) => kaPracticeItem(problem, (id) => getSkill(id)?.name));

function choice(key: string) {
  const group = screen.getByRole('group', { name: /answer choices/i });
  const button = within(group)
    .getAllByRole('button')
    .find((b) => b.textContent?.trim().startsWith(key));
  if (!button) throw new Error(`no choice ${key}`);
  return button;
}

beforeEach(() => window.localStorage.clear());

describe('the practice session', () => {
  it('has no axe violations on a fresh question, in either theme', async () => {
    const { container } = render(<PracticeSession items={items} title="Practice set" />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with wrong-answer feedback, a hint and the navigator open', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    const wrong = item.choices.find((c) => !c.correct)?.key ?? 'A';
    const { container } = render(<PracticeSession items={items} title="Practice set" />);
    await user.click(screen.getByText('A nudge'));
    await user.click(choice(wrong));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: /Mark for review/ }));
    await user.click(screen.getByRole('button', { name: /Question 1 of/, expanded: false }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations on the end screen', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    const { container } = render(<PracticeSession items={items} title="Practice set" />);
    await user.click(choice(item.choices.find((c) => c.correct)?.key ?? 'A'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: /Question 1 of/ }));
    await user.click(screen.getByRole('button', { name: 'Finish set' }));
    expect(screen.getByRole('heading', { name: 'Set complete' })).toBeInTheDocument();
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations as a set of one', async () => {
    const { container } = render(
      <main>
        <PracticeSession
          items={[items[0] as KaPracticeItem]}
          title="x"
          mode="single"
          headingLevel={1}
        />
      </main>,
    );
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
