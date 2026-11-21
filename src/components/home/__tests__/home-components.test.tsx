import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GradeMap, GRADES } from '../GradeMap';
import { InlinePotd, type PotdPick } from '../InlinePotd';
import { EXAMS, examsForGrade } from '@/lib/exams';
import { getAllProblems, getSkill } from '@/lib/content';
import { kaPracticeItem } from '@/lib/practice-item';
import { dayNumber } from '@/lib/potd';
import { readProgress } from '@/lib/local-progress';
import { resetProgressCache } from '@/components/mastery/useProgress';

function highlighted(container: HTMLElement): string[] {
  return [...container.querySelectorAll('li[data-exam][data-highlighted="true"]')].map(
    (li) => li.getAttribute('data-exam') ?? '',
  );
}

describe('<GradeMap>', () => {
  it('draws one bar per catalog exam and twelve grade buttons, none chosen', () => {
    const { container } = render(<GradeMap />);
    expect(container.querySelectorAll('li[data-exam]')).toHaveLength(EXAMS.length);
    const group = screen.getByRole('group', { name: 'Grade' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons).toHaveLength(GRADES.length);
    for (const button of buttons) expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(highlighted(container)).toEqual([]);
  });

  it('highlights exactly the exams that fit the chosen grade and lists them with links', async () => {
    const { container } = render(<GradeMap />);
    await userEvent.click(screen.getByRole('button', { name: 'Grade 7' }));
    expect(screen.getByRole('button', { name: 'Grade 7' })).toHaveAttribute('aria-pressed', 'true');

    const expected = examsForGrade(7).map((exam) => exam.id);
    expect(expected).toEqual(expect.arrayContaining(['ka', 'amc8', 'mathcounts']));
    expect(highlighted(container).sort()).toEqual([...expected].sort());

    const result = screen.getByTestId('grade-map-result');
    expect(result).toHaveTextContent(`In grade 7: ${expected.length} exams`);
    for (const exam of examsForGrade(7)) {
      expect(
        within(result).getByRole('link', { name: new RegExp(`^${exam.name}`) }),
      ).toHaveAttribute('href', exam.routes.page);
    }
    // Kangaroo names the level for that grade; a soon exam says so.
    expect(result).toHaveTextContent('Level 7-8');
    expect(within(result).getByRole('link', { name: /MATHCOUNTS/ })).toHaveTextContent(
      'Coming soon',
    );
    expect(screen.getByTestId('grade-map-mascot')).toHaveAttribute('data-grade', '7');
  });

  it('moves the highlight when another grade is chosen, and clears it on a second press', async () => {
    const { container } = render(<GradeMap />);
    await userEvent.click(screen.getByRole('button', { name: 'Grade 11' }));
    expect(highlighted(container).sort()).toEqual(
      examsForGrade(11)
        .map((e) => e.id)
        .sort(),
    );
    expect(highlighted(container)).not.toContain('amc8');
    expect(screen.getByRole('button', { name: 'Grade 7' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Grade 11' }));
    expect(highlighted(container)).toEqual([]);
    expect(screen.queryByTestId('grade-map-result')).toBeNull();
  });

  it('works from the keyboard: arrows move between grades, Enter chooses', async () => {
    const { container } = render(<GradeMap />);
    screen.getByRole('button', { name: 'Grade 1' }).focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Grade 3' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Grade 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(highlighted(container).sort()).toEqual(
      examsForGrade(3)
        .map((e) => e.id)
        .sort(),
    );
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Grade 12' })).toHaveFocus();
  });

  it('keeps the mascot out of the accessibility tree', () => {
    render(<GradeMap />);
    const mascot = screen.getByTestId('grade-map-mascot');
    expect(mascot.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('<InlinePotd>', () => {
  const problem = getAllProblems().find((p) => p.figure === null);
  if (!problem) throw new Error('no figure-free problem');
  const pick: PotdPick = {
    item: kaPracticeItem(problem, (id) => getSkill(id)?.name),
    skillName: getSkill(problem.skills.primary)?.name ?? null,
  };
  const wrong = problem.choices.find((c) => !c.correct);
  const right = problem.choices.find((c) => c.correct);
  if (!wrong || !right) throw new Error('bad fixture');
  const today = dayNumber(new Date());

  beforeEach(() => {
    window.localStorage.clear();
    resetProgressCache();
  });

  it('shows the full statement and five choices, with no feedback before an answer', () => {
    render(<InlinePotd picks={[pick]} startDay={today} />);
    const card = screen.getByRole('region', { name: 'Puzzle of the day' });
    expect(within(card).getAllByRole('button', { name: /^[A-E]/ })).toHaveLength(5);
    expect(screen.queryByTestId('feedback')).toBeNull();
  });

  it('answers a wrong choice with its own misconception and opens the hints', async () => {
    render(<InlinePotd picks={[pick]} startDay={today} />);
    await userEvent.click(document.getElementById(`potd-${problem.id}-${wrong.key}`) as Element);
    const feedback = screen.getByTestId('feedback');
    expect(feedback).toHaveAttribute('data-outcome', 'incorrect');
    expect(feedback).toHaveTextContent(wrong.misconception?.slice(0, 30) ?? '');
    expect(screen.getByRole('heading', { name: /Hints/ })).toBeInTheDocument();
  });

  it('records only the first answer, through the practice recorder', async () => {
    let attempts = 0;
    render(<InlinePotd picks={[pick]} startDay={today} onAttempt={() => (attempts += 1)} />);
    await userEvent.click(document.getElementById(`potd-${problem.id}-${wrong.key}`) as Element);
    await userEvent.click(document.getElementById(`potd-${problem.id}-${right.key}`) as Element);
    expect(attempts).toBe(1);
    const recorded = Object.values(readProgress().attempts)
      .flat()
      .filter((a) => a.problemId === problem.id);
    // One record per tagged skill, all of them the first (wrong) pick, in practice mode.
    expect(recorded.length).toBe(1 + problem.skills.secondary.length);
    expect(recorded.every((a) => !a.correct && a.mode === 'practice')).toBe(true);
    // The second pick still gets feedback: the solution, and the correct choice marked.
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
  });
});
