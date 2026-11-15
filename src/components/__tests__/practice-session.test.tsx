import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PracticeSession, PracticeSetLoader } from '../practice-session';
import { MathProvider } from '../math/MathProvider';
import {
  initialSession,
  sessionReducer,
  summarize,
  formatClock,
} from '../practice-session/session-state';
import { getAllProblems, getSkill } from '@/lib/content';
import {
  amcPracticeItem,
  kaPracticeItem,
  parsePracticeSetQuery,
  practiceSetHref,
  type KaPracticeItem,
} from '@/lib/practice-item';
import type { AmcProblem } from '@/lib/amc-schemas';
import { readProgress } from '@/lib/local-progress';
import { amcStatusOf, statusOfProblem } from '@/lib/progress-summary';
import { track } from '@/lib/telemetry/client';
import { installStaticDataFetch } from '../../../test/static-data';

vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const items: KaPracticeItem[] = getAllProblems()
  .slice(0, 3)
  .map((problem) => kaPracticeItem(problem, (id) => getSkill(id)?.name));

function choiceButton(key: string) {
  const group = screen.getByRole('group', { name: /answer choices/i });
  const button = within(group)
    .getAllByRole('button')
    .find((b) => b.textContent?.trim().startsWith(key));
  if (!button) throw new Error(`no choice ${key}`);
  return button;
}

const right = (item: KaPracticeItem) => item.choices.find((c) => c.correct)?.key ?? 'A';
const wrongChoice = (item: KaPracticeItem) => {
  const choice = item.choices.find((c) => !c.correct);
  if (!choice) throw new Error('no wrong choice');
  return choice;
};

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(track).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('answering', () => {
  it('shows the set name, the position and the question', () => {
    render(<PracticeSession items={items} title="Practice set" />);
    expect(screen.getByText('Practice set')).toBeInTheDocument();
    expect(screen.getAllByText('Question 1 of 3').length).toBeGreaterThan(0);
    expect(screen.getByText(items[0]?.statement ?? '')).toBeInTheDocument();
  });

  it('judges nothing until Check, and Check needs a pick', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    render(<PracticeSession items={items} title="Set" />);
    const check = screen.getByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    await user.click(choiceButton(wrongChoice(item).key));
    expect(screen.queryByTestId('feedback')).toBeNull();
    expect(choiceButton(wrongChoice(item).key).textContent).not.toMatch(/your answer/);
    expect(check).toBeEnabled();
  });

  it('gives the misconception for the exact wrong letter on Check', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    const wrong = wrongChoice(item);
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(wrong.key));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const feedback = screen.getByTestId('feedback');
    expect(feedback).toHaveAttribute('data-outcome', 'incorrect');
    expect(feedback.textContent).toContain(wrong.misconception ?? '');
    // The hints and the solution are there after the first check.
    expect(screen.getByRole('heading', { name: 'Hints' })).toBeInTheDocument();
    expect(screen.getByText('Solution')).toBeInTheDocument();
  });

  it('marks a right answer correct and reveals it', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(right(item)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
    expect(choiceButton(right(item)).textContent).toMatch(/correct/);
  });
});

describe('recording attempts', () => {
  it('records the first Check against every skill, as the problem page does', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(right(item)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(statusOfProblem(readProgress(), item.id, item.skillIds)).toBe('mastered');
    for (const skillId of item.skillIds) {
      expect(readProgress().attempts[skillId]?.some((a) => a.problemId === item.id)).toBe(true);
    }
  });

  it('records only the first Check, so changing an answer cannot farm a correct one', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(wrongChoice(item).key));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(choiceButton(right(item)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
    expect(statusOfProblem(readProgress(), item.id, item.skillIds)).toBe('seen');
    expect(readProgress().attempts[item.skillIds[0] ?? '']).toHaveLength(1);
  });

  it('sends the same choice_select event as the problem page, once', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    const wrong = wrongChoice(item);
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(wrong.key));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(choiceButton(right(item)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('choice_select', {
      surface: 'practice-set',
      context: 'free',
      problemId: item.id,
      skillId: item.skillIds[0],
      points: item.points,
      band: item.band,
      choiceKey: wrong.key,
      correct: false,
      hintLevel: 0,
    });
  });

  it('counts hints opened before the first Check', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    render(<PracticeSession items={items} title="Set" />);
    await user.click(screen.getByText('A nudge'));
    await user.click(screen.getByText('The strategy'));
    await user.click(choiceButton(right(item)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const attempt = readProgress().attempts[item.skillIds[0] ?? '']?.[0];
    expect(attempt?.hintsUsed).toBe(2);
    // Right, but with the strategy hint: solved, not solved cleanly.
    expect(statusOfProblem(readProgress(), item.id, item.skillIds)).toBe('shaky');
  });

  it('records an AMC attempt under the AM id', async () => {
    const user = userEvent.setup();
    const amc = amcPracticeItem(AMC_FIXTURE, () => 'Linear equations');
    render(
      <MathProvider>
        <PracticeSession items={[amc]} title="AMC set" exitHref="/amc/problems" />
      </MathProvider>,
    );
    // Statement math is typeset by KaTeX.
    expect(document.querySelector('.katex')).not.toBeNull();
    await user.click(choiceButton('B'));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(amcStatusOf(readProgress(), 'AM-9001')).toBe('mastered');
    expect(track).not.toHaveBeenCalled();
    expect(screen.getByText('Early (slots 1-10)')).toBeInTheDocument();
  });
});

describe('moving around a set', () => {
  it('goes forward and back with Next and Back', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: /Question 2/ })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: /Question 1/ })).toBeInTheDocument();
  });

  it('keeps each question’s answer when you come back to it', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(right(item)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByTestId('feedback')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
  });

  it('opens a navigator grid that shows answered and current, and jumps', async () => {
    const user = userEvent.setup();
    const item = items[0] as KaPracticeItem;
    render(<PracticeSession items={items} title="Set" />);
    await user.click(choiceButton(right(item)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const toggle = screen.getByRole('button', { name: /Question 1 of 3/, expanded: false });
    await user.click(toggle);
    const grid = screen.getByRole('group', { name: 'Go to question' });
    const first = within(grid).getByRole('button', { name: 'Question 1, answered' });
    expect(first).toHaveAttribute('aria-current', 'step');
    expect(first).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(toggle).toHaveFocus();
    await user.click(toggle);
    await user.click(within(grid).getByRole('button', { name: 'Question 3, not answered' }));
    expect(screen.getByRole('heading', { name: /Question 3/ })).toBeInTheDocument();
  });

  it('marks a question for review, and the navigator says so', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    const mark = screen.getByRole('button', { name: /Mark for review/ });
    expect(mark).toHaveAttribute('aria-pressed', 'false');
    await user.click(mark);
    expect(screen.getByRole('button', { name: /Marked for review/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /Question 1 of 3/ }));
    expect(
      screen.getByRole('button', { name: 'Question 1, not answered, marked for review' }),
    ).toBeInTheDocument();
  });

  it('can hide and show the timer', async () => {
    const user = userEvent.setup();
    render(<PracticeSession items={items} title="Set" />);
    expect(screen.getByRole('timer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide timer' }));
    expect(screen.queryByRole('timer')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show timer' }));
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });
});

describe('the end of a set', () => {
  async function playSet() {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<PracticeSession items={items} title="Set" onFinish={onFinish} />);
    // Q1 right, Q2 wrong, Q3 skipped.
    await user.click(choiceButton(right(items[0] as KaPracticeItem)));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(choiceButton(wrongChoice(items[1] as KaPracticeItem).key));
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    return { user, onFinish };
  }

  it('shows the score, the time and a bar per skill', async () => {
    const { onFinish } = await playSet();
    expect(screen.getByRole('heading', { name: 'Set complete' })).toHaveFocus();
    const score = screen.getAllByText('Right first time').find((el) => el.tagName === 'DT');
    expect(score?.nextSibling?.textContent).toBe('1 / 3');
    expect(screen.getByRole('progressbar', { name: 'This set' })).toHaveAttribute(
      'aria-valuetext',
      '1 of 3 right first time',
    );
    const groups = new Set(items.map((item) => item.groups[0]?.name));
    for (const name of groups) {
      expect(screen.getByRole('progressbar', { name })).toBeInTheDocument();
    }
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ correct: 1, total: 3 }));
  });

  it('offers "Review missed" as a set of exactly the missed ids', async () => {
    await playSet();
    const link = screen.getByRole('link', { name: 'Review missed (2)' });
    const query = parsePracticeSetQuery(
      new URL(link.getAttribute('href') ?? '', 'http://x').search,
    );
    expect(query.ids).toEqual([items[1]?.id, items[2]?.id]);
    expect(query.name).toBe('Review missed');
    expect(screen.getByRole('link', { name: 'Back to the bank' })).toHaveAttribute(
      'href',
      '/problems',
    );
  });

  it('can go back to an unanswered question from the end screen', async () => {
    const { user } = await playSet();
    await user.click(screen.getByRole('button', { name: 'Look again at question 3' }));
    expect(screen.getByRole('heading', { name: /Question 3/ })).toBeInTheDocument();
  });
});

describe('a set of one, for a problem page', () => {
  it('has a level-1 heading and no navigator, mark or end screen', () => {
    render(
      <PracticeSession
        items={[items[0] as KaPracticeItem]}
        title="x"
        mode="single"
        headingLevel={1}
        headingSuffix="A skill"
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(items[0]?.id ?? '');
    expect(screen.queryByRole('navigation', { name: 'Questions' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mark for review/ })).toBeNull();
  });
});

describe('/practice/set', () => {
  it('loads the ids in the URL from the static data and runs them', async () => {
    installStaticDataFetch();
    const ids = items.map((item) => item.id);
    render(<PracticeSetLoader search={new URL(practiceSetHref({ ids }), 'http://x').search} />);
    expect(await screen.findByRole('heading', { name: /Question 1/ })).toBeInTheDocument();
    expect(screen.getAllByText('Question 1 of 3').length).toBeGreaterThan(0);
  });

  it('says how to make a set when the URL has none', async () => {
    installStaticDataFetch();
    render(<PracticeSetLoader search="" />);
    expect(await screen.findByText('No questions picked yet')).toBeInTheDocument();
  });

  it('drops an id that no longer exists and says so at the end', async () => {
    installStaticDataFetch();
    const user = userEvent.setup();
    render(<PracticeSetLoader search={`?ids=${items[0]?.id},KA-9999`} />);
    await screen.findByRole('heading', { name: /Question 1/ });
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() =>
      expect(screen.getByText(/One question from the link could not be found/)).toBeInTheDocument(),
    );
  });
});

describe('/practice/set with an AMC set', () => {
  it('loads AMC items and typesets their math', async () => {
    const amc = amcPracticeItem(AMC_FIXTURE, () => 'Linear equations');
    installStaticDataFetch({ '/data/p/AM-9001.json': amc });
    render(<PracticeSetLoader search="?bank=amc&ids=AM-9001" />);
    expect(await screen.findByText('AMC practice set')).toBeInTheDocument();
    expect(document.querySelector('.katex')).not.toBeNull();
  });

  it('never mixes a Kangaroo id into an AMC set', async () => {
    installStaticDataFetch();
    render(<PracticeSetLoader search={`?bank=amc&ids=${items[0]?.id}`} />);
    expect(await screen.findByText('No questions picked yet')).toBeInTheDocument();
  });
});

describe('session rules', () => {
  it('ignores Check with nothing picked, and a hint can only go up', () => {
    let state = initialSession(2);
    state = sessionReducer(state, { type: 'check', correct: true });
    expect(state.questions[0]?.firstCorrect).toBeNull();
    state = sessionReducer(state, { type: 'hint', level: 2 });
    state = sessionReducer(state, { type: 'hint', level: 1 });
    expect(state.questions[0]?.hints).toBe(2);
  });

  it('summarises by primary group and keeps unanswered in the missed set', () => {
    let state = initialSession(items.length);
    state = sessionReducer(state, { type: 'pick', key: 'A' });
    state = sessionReducer(state, { type: 'check', correct: true });
    const summary = summarize(items, state);
    expect(summary.correct).toBe(1);
    expect(summary.unanswered).toBe(2);
    expect(summary.missedIds).toEqual(items.slice(1).map((item) => item.id));
  });

  it('formats the clock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

const AMC_FIXTURE: AmcProblem = {
  id: 'AM-9001',
  contest: 'AMC10',
  slot: 4,
  area: 'ALG',
  topic: 'ALG-01',
  types: ['T-WORKING-BACKWARDS'],
  statement: 'If $3x + 4 = 19$, what is $x$?',
  figure: null,
  choices: [
    {
      key: 'A',
      text: '$3$',
      correct: false,
      misconception: 'I subtracted 4 from 19 and then divided by 5 instead of by 3.',
    },
    { key: 'B', text: '$5$', correct: true, misconception: null },
    {
      key: 'C',
      text: '$\\frac{23}{3}$',
      correct: false,
      misconception: 'I added 4 to 19 instead of subtracting it before dividing by 3.',
    },
    {
      key: 'D',
      text: '$15$',
      correct: false,
      misconception: 'I subtracted 4 from 19 and stopped before dividing by the 3.',
    },
    {
      key: 'E',
      text: '$45$',
      correct: false,
      misconception: 'I multiplied 15 by 3 when I should have divided 15 by 3.',
    },
  ],
  hints: [
    'Undo the last operation first.',
    'Subtract 4 from both sides, then divide.',
    'Subtracting 4 gives 3x = 15, and dividing by 3 gives x = 5.',
  ],
  solutions: {
    reliable:
      'Subtract 4 from both sides to get $3x = 15$, then divide both sides by 3 to get $x = 5$.',
    elegant: null,
  },
  formulas: [],
  estSeconds: 45,
  calibration: { pValue: null, medianMs: null, n: 0 },
  author: 'Test Author',
  reviewedBy: ['pending-review'],
  createdAt: '2026-11-14',
  license: 'CC-BY-NC-SA-4.0',
};
