import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { difficultyLabel, DifficultyPill } from '../DifficultyPill';
import { BandPill, bandLabel } from '../BandPill';
import { SkillChip, UnknownSkillChip } from '../SkillChip';
import { FigureRenderer } from '../FigureRenderer';
import { ChoiceList } from '../ChoiceList';
import { FeedbackPanel } from '../FeedbackPanel';
import { HintLadder, HINT_REVEAL_EVENT, type HintRevealDetail } from '../HintLadder';
import { SolutionTabs } from '../SolutionTabs';
import { ProblemInteractive } from '../ProblemInteractive';
import { ProblemCard } from '../ProblemCard';
import { FIGURES } from '../figures/registry';
import { getProblem } from '@/lib/content';
import type { Choice, Problem } from '@/lib/schemas';

function problemOrThrow(id: string): Problem {
  const problem = getProblem(id);
  if (!problem) throw new Error(`${id} is missing from content/`);
  return problem;
}

/** A problem with a figure, two solutions, and a full distractor set. */
const withFigure = problemOrThrow('KA-0001');
/** A problem whose elegant solution is deliberately null. */
const noElegant = problemOrThrow('KA-0006');

function renderInTheme(ui: React.ReactElement, theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  return render(ui);
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

const THEMES = ['light', 'dark'] as const;

/* -------------------------------------------------------------------------- */

describe('DifficultyPill', () => {
  it.each([3, 4, 5] as const)('states the %s-point tier in words, not colour alone', (points) => {
    render(<DifficultyPill points={points} />);
    expect(screen.getByText(`${points} pt`)).toBeInTheDocument();
  });

  it('uses the neutral difficulty ramp, never a reserved feedback colour', () => {
    // docs/05 §3. v1 painted the 5-point tier rose — the same variable as "incorrect" — so a
    // student saw red on the hardest problems before reading a word of them.
    for (const [points, expected] of [
      [3, 'bg-d1-bg text-d1-fg'],
      [4, 'bg-d2-bg text-d2-fg'],
      [5, 'bg-d3-bg text-d3-fg'],
    ] as const) {
      const { container, unmount } = render(<DifficultyPill points={points} />);
      const className = container.firstElementChild?.className ?? '';
      expect(className, `${points}pt`).toContain(expected);
      expect(className, `${points}pt must not use a reserved colour`).not.toMatch(
        /correct|wrong|hint/,
      );
      unmount();
    }
  });

  it.each([
    [3, '\u25cf\u25cb\u25cb'],
    [4, '\u25cf\u25cf\u25cb'],
    [5, '\u25cf\u25cf\u25cf'],
  ] as const)('carries the tier as %s filled dots, so it survives greyscale', (points, dots) => {
    const { container } = render(<DifficultyPill points={points} />);
    expect(container.textContent).toContain(dots);
  });

  it('gives a screen reader words rather than three circle glyphs', () => {
    render(<DifficultyPill points={5} />);
    expect(screen.getByText('5 points, difficulty 3 of 3')).toBeInTheDocument();
    expect(difficultyLabel(3)).toBe('3 points, difficulty 1 of 3');
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    const { container } = renderInTheme(<DifficultyPill points={4} />, theme);
    expect(container.textContent).toContain('4 pt');
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });
});

describe('BandPill', () => {
  it('writes the level with an en dash, as the official papers do', () => {
    expect(bandLabel('5-6')).toBe('Level 5–6');
    render(<BandPill band="3-4" />);
    expect(screen.getByText('Level 3–4')).toBeInTheDocument();
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(<BandPill band="11-12" />, theme);
    expect(screen.getByText('Level 11–12')).toBeInTheDocument();
  });
});

describe('SkillChip', () => {
  const skill = { id: 'CNT-12', name: 'Counting by position (sliding window)' };

  it('links to the skill page and shows the permanent id alongside the name', () => {
    render(<SkillChip skill={skill} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/skill/CNT-12');
    expect(link).toHaveTextContent('CNT-12');
    expect(link).toHaveTextContent('Counting by position');
  });

  it('marks the primary skill differently from the secondary ones', () => {
    const { container: primary } = render(<SkillChip skill={skill} variant="primary" />);
    const { container: normal } = render(<SkillChip skill={skill} />);
    expect(primary.firstElementChild?.className).toContain('border-accent-600');
    expect(normal.firstElementChild?.className).not.toContain('border-accent-600');
  });

  it('shows an unresolved id rather than dropping it silently', () => {
    render(<UnknownSkillChip id="ZZZ-99" />);
    expect(screen.getByText(/ZZZ-99/)).toBeInTheDocument();
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(<SkillChip skill={skill} />, theme);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */

describe('FigureRenderer', () => {
  const figure = {
    component: 'BoardThreeByThree',
    alt: 'A square board divided into nine equal small squares.',
  };

  it('resolves the component named in the problem JSON', () => {
    const { container } = render(<FigureRenderer figure={figure} problemId="KA-0001" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('gives the figure its author-written alt text as an accessible name', () => {
    render(<FigureRenderer figure={figure} problemId="KA-0001" />);
    expect(screen.getByRole('img', { name: figure.alt })).toBeInTheDocument();
  });

  it('hides the drawing itself from assistive technology', () => {
    const { container } = render(<FigureRenderer figure={figure} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('also offers the description as readable text', async () => {
    render(<FigureRenderer figure={figure} problemId="KA-0001" />);
    await userEvent.click(screen.getByText(/text description of the figure/i));
    expect(screen.getByText(figure.alt)).toBeVisible();
  });

  it('falls back to the description when a component name does not resolve', () => {
    render(<FigureRenderer figure={{ component: 'NoSuchFigure', alt: figure.alt }} />);
    expect(screen.getByText(figure.alt)).toBeInTheDocument();
    expect(screen.getByText(/could not be rendered/i)).toBeInTheDocument();
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    const { container } = renderInTheme(<FigureRenderer figure={figure} />, theme);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('the figure registry', () => {
  it('registers every figure referenced by a problem', () => {
    const referenced = new Set(
      [withFigure, noElegant].flatMap((p) => (p.figure ? [p.figure.component] : [])),
    );
    for (const name of referenced) expect(FIGURES[name], name).toBeDefined();
  });

  it('renders every registered figure without throwing', () => {
    for (const [name, Component] of Object.entries(FIGURES)) {
      const { container, unmount } = render(<Component />);
      expect(container.querySelector('svg'), name).toBeInTheDocument();
      unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */

const CHOICES: Choice[] = [
  { key: 'A', text: '1', correct: false, misconception: 'I split the board into separate blocks.' },
  { key: 'B', text: '2', correct: false, misconception: 'I slid the square across only one row.' },
  { key: 'C', text: '4', correct: true, misconception: null },
  { key: 'D', text: '6', correct: false, misconception: 'I added the rows to the positions.' },
  { key: 'E', text: '9', correct: false, misconception: 'I counted the nine small squares.' },
];

describe('ChoiceList', () => {
  it('renders exactly five choices as buttons in a labelled group', () => {
    render(<ChoiceList choices={CHOICES} selected={null} onSelect={() => {}} />);
    const group = screen.getByRole('group', { name: /answer choices/i });
    expect(within(group).getAllByRole('button')).toHaveLength(5);
  });

  it('marks selection with aria-pressed', () => {
    render(<ChoiceList choices={CHOICES} selected="C" onSelect={() => {}} />);
    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent('4');
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4);
  });

  it('reports the chosen key to its parent', async () => {
    const onSelect = vi.fn();
    render(<ChoiceList choices={CHOICES} selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /E\s*9/ }));
    expect(onSelect).toHaveBeenCalledWith('E');
  });

  it('is operable with the keyboard alone', async () => {
    const onSelect = vi.fn();
    render(<ChoiceList choices={CHOICES} selected={null} onSelect={onSelect} />);
    await userEvent.tab();
    expect(screen.getAllByRole('button')[0]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('A');
  });

  it('moves between choices with the arrow keys as well as with Tab', async () => {
    render(<ChoiceList choices={CHOICES} selected={null} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    buttons[0]?.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(buttons[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(buttons[4]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(buttons[0]).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(buttons[0]).toHaveFocus();
  });

  it('names a wrong selection in words, not in colour alone', () => {
    render(<ChoiceList choices={CHOICES} selected="A" onSelect={() => {}} />);
    expect(screen.getByText('your answer')).toBeInTheDocument();
  });

  it('does not point at the correct answer just because something was selected', () => {
    render(<ChoiceList choices={CHOICES} selected="A" onSelect={() => {}} />);
    expect(screen.queryByText('correct')).not.toBeInTheDocument();
  });

  it('marks the correct answer only when the parent asks it to', () => {
    render(<ChoiceList choices={CHOICES} selected="C" onSelect={() => {}} revealAnswer />);
    expect(screen.getByText('correct')).toBeInTheDocument();
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(
      <ChoiceList choices={CHOICES} selected="C" onSelect={() => {}} revealAnswer />,
      theme,
    );
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});

/* -------------------------------------------------------------------------- */

describe('FeedbackPanel — the distractor-specific behaviour that is the product', () => {
  const problem = {
    choices: CHOICES,
    solutions: {
      reliable: 'Fix the square by its top-left corner and count the corner positions.',
      elegant: null,
    },
    whyOnTest: 'Sliding beats splitting.',
  };

  it('says nothing at all before a choice is made', () => {
    render(<FeedbackPanel problem={problem} selectedKey={null} />);
    expect(screen.queryByTestId('feedback')).not.toBeInTheDocument();
  });

  it.each(CHOICES.filter((c) => !c.correct).map((c) => [c.key, c.misconception] as const))(
    'shows the misconception recorded for choice %s, and no other',
    (key, misconception) => {
      render(<FeedbackPanel problem={problem} selectedKey={key} />);
      const panel = screen.getByTestId('feedback');
      expect(panel).toHaveAttribute('data-outcome', 'incorrect');
      expect(panel).toHaveTextContent(misconception ?? '');
      // The misconceptions of the other wrong choices must not leak into the panel.
      for (const other of CHOICES) {
        if (other.key === key || !other.misconception) continue;
        expect(panel).not.toHaveTextContent(other.misconception);
      }
    },
  );

  it('never shows the solution to a student who got it wrong', () => {
    render(<FeedbackPanel problem={problem} selectedKey="A" />);
    expect(screen.getByTestId('feedback')).not.toHaveTextContent(problem.solutions.reliable);
  });

  it('never names the correct letter to a student who got it wrong', () => {
    // Handing over the letter would make the hint ladder decorative.
    for (const wrong of CHOICES.filter((c) => !c.correct)) {
      const { unmount } = render(<FeedbackPanel problem={problem} selectedKey={wrong.key} />);
      const panel = screen.getByTestId('feedback');
      expect(panel.textContent).not.toMatch(/\bC\b/);
      unmount();
    }
  });

  it('shows the reliable method when the answer is right, so a guess still teaches', () => {
    render(<FeedbackPanel problem={problem} selectedKey="C" />);
    const panel = screen.getByTestId('feedback');
    expect(panel).toHaveAttribute('data-outcome', 'correct');
    expect(panel).toHaveTextContent(problem.solutions.reliable);
  });

  it('announces the result without moving focus', () => {
    render(<FeedbackPanel problem={problem} selectedKey="B" />);
    expect(screen.getByTestId('feedback')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('feedback')).toHaveAttribute('role', 'status');
  });

  it('works on every wrong choice of every real problem in the bank', () => {
    for (const choice of withFigure.choices) {
      if (choice.correct) continue;
      const { unmount } = render(<FeedbackPanel problem={withFigure} selectedKey={choice.key} />);
      expect(screen.getByTestId('feedback')).toHaveTextContent(choice.misconception ?? '');
      unmount();
    }
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(<FeedbackPanel problem={problem} selectedKey="D" />, theme);
    expect(screen.getByTestId('feedback')).toBeInTheDocument();
  });
});

describe('ProblemInteractive', () => {
  it('does not mark the correct choice until the student has found it', async () => {
    render(<ProblemInteractive problem={withFigure} />);
    const wrong = withFigure.choices.find((c) => !c.correct);
    const right = withFigure.choices.find((c) => c.correct);
    if (!wrong || !right) throw new Error('malformed fixture');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${wrong.key}`) }));
    expect(screen.queryByText('correct')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${right.key}`) }));
    expect(screen.getByText('correct')).toBeInTheDocument();
  });

  it('feeds the chosen key straight into the feedback panel', async () => {
    render(<ProblemInteractive problem={withFigure} />);
    expect(screen.queryByTestId('feedback')).not.toBeInTheDocument();
    const wrong = withFigure.choices.find((c) => !c.correct);
    if (!wrong) throw new Error('every problem has a wrong choice');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${wrong.key}`) }));
    expect(screen.getByTestId('feedback')).toHaveTextContent(wrong.misconception ?? '');
  });

  it('lets a student change their answer, because a wrong answer costs nothing', async () => {
    render(<ProblemInteractive problem={withFigure} />);
    const wrong = withFigure.choices.find((c) => !c.correct);
    const right = withFigure.choices.find((c) => c.correct);
    if (!wrong || !right) throw new Error('malformed fixture');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${wrong.key}`) }));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${right.key}`) }));
    expect(screen.getByTestId('feedback')).toHaveAttribute('data-outcome', 'correct');
  });
});

/* -------------------------------------------------------------------------- */

describe('HintLadder', () => {
  const hints: [string, string, string] = [
    'Slide the small square one step at a time.',
    'A 2 by 2 square is fixed by where its top-left corner sits.',
    'The corner can sit in 2 columns and 2 rows, so 4 positions.',
  ];

  it('lists three rungs, labelled in escalating order', () => {
    render(<HintLadder problemId="KA-0001" hints={hints} />);
    expect(screen.getByText(/a nudge/i)).toBeInTheDocument();
    expect(screen.getByText(/the strategy/i)).toBeInTheDocument();
    expect(screen.getByText(/the full solution/i)).toBeInTheDocument();
  });

  it('locks the later rungs until the earlier ones are opened', async () => {
    render(<HintLadder problemId="KA-0001" hints={hints} />);
    expect(screen.getByText(/open hint 1 first/i)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/a nudge/i));
    expect(screen.queryByText(/open hint 1 first/i)).not.toBeInTheDocument();
    expect(screen.getByText(/open hint 2 first/i)).toBeInTheDocument();
  });

  it('emits one event per reveal, with the level, and never twice for the same rung', async () => {
    const seen: HintRevealDetail[] = [];
    const listener = (event: Event) => seen.push((event as CustomEvent<HintRevealDetail>).detail);
    window.addEventListener(HINT_REVEAL_EVENT, listener);

    render(<HintLadder problemId="KA-0001" hints={hints} />);
    await userEvent.click(screen.getByText(/a nudge/i));
    await userEvent.click(screen.getByText(/the strategy/i));
    // Closing and reopening rung 1 must not log a second reveal.
    await userEvent.click(screen.getByText(/a nudge/i));
    await userEvent.click(screen.getByText(/a nudge/i));

    window.removeEventListener(HINT_REVEAL_EVENT, listener);
    expect(seen).toEqual([
      { problemId: 'KA-0001', level: 1 },
      { problemId: 'KA-0001', level: 2 },
    ]);
  });

  it('also calls the onReveal prop, so a page can record without a global listener', async () => {
    const onReveal = vi.fn();
    render(<HintLadder problemId="KA-0007" hints={hints} onReveal={onReveal} />);
    await userEvent.click(screen.getByText(/a nudge/i));
    expect(onReveal).toHaveBeenCalledWith({ problemId: 'KA-0007', level: 1 });
  });

  it('puts every hint in the HTML, so a reader without JavaScript still gets them', () => {
    const { container } = render(<HintLadder problemId="KA-0001" hints={hints} />);
    for (const hint of hints) expect(container.textContent).toContain(hint);
    expect(container.querySelectorAll('details')).toHaveLength(3);
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(<HintLadder problemId="KA-0001" hints={hints} />, theme);
    expect(screen.getAllByRole('group')).toHaveLength(3);
  });
});

/* -------------------------------------------------------------------------- */

describe('SolutionTabs', () => {
  const reliable = 'Count the corner positions: two columns by two rows.';
  const elegant = 'On an n by n board there are (n-1) squared such squares.';

  it('offers two tabs when both solutions exist', () => {
    render(<SolutionTabs reliable={reliable} elegant={elegant} defaultOpen />);
    expect(screen.getByRole('tablist', { name: /solution methods/i })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('says plainly when there is no elegant route, rather than showing an empty tab', () => {
    render(<SolutionTabs reliable={reliable} elegant={null} defaultOpen />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText(/no shortcut on this one/i)).toBeInTheDocument();
    expect(screen.getByText(reliable)).toBeVisible();
  });

  it('switches panels on click', async () => {
    render(<SolutionTabs reliable={reliable} elegant={elegant} defaultOpen />);
    expect(screen.getByText(elegant)).not.toBeVisible();
    await userEvent.click(screen.getByRole('tab', { name: /elegant/i }));
    expect(screen.getByText(elegant)).toBeVisible();
    expect(screen.getByText(reliable)).not.toBeVisible();
  });

  it('moves between tabs with the arrow keys, as a tablist should', async () => {
    render(<SolutionTabs reliable={reliable} elegant={elegant} defaultOpen />);
    const [first, second] = screen.getAllByRole('tab');
    first?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps both solutions in the HTML so nothing is lost without JavaScript', () => {
    const { container } = render(<SolutionTabs reliable={reliable} elegant={elegant} />);
    expect(container.textContent).toContain(reliable);
    expect(container.textContent).toContain(elegant);
    expect(container.querySelector('noscript')).toBeInTheDocument();
  });

  it('stays collapsed by default, so the answer is not on screen before the attempt', () => {
    const { container } = render(<SolutionTabs reliable={reliable} elegant={elegant} />);
    expect(container.querySelector('details')?.open).toBe(false);
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(<SolutionTabs reliable={reliable} elegant={elegant} defaultOpen />, theme);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */

describe('ProblemCard', () => {
  it('renders the statement, the five choices and the metadata', () => {
    render(<ProblemCard problem={withFigure} />);
    expect(screen.getByText(withFigure.statement)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(5);
    expect(screen.getByText(`${withFigure.points} pt`)).toBeInTheDocument();
    expect(screen.getByText(/Level/)).toBeInTheDocument();
  });

  it('renders the figure with its alt text', () => {
    render(<ProblemCard problem={withFigure} />);
    expect(screen.getByRole('img', { name: withFigure.figure?.alt })).toBeInTheDocument();
  });

  it('links every tagged skill to its page, primary first', () => {
    render(<ProblemCard problem={withFigure} />);
    const skillLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/skill/'));
    expect(skillLinks.length).toBe(1 + withFigure.skills.secondary.length);
    expect(skillLinks[0]).toHaveAttribute('href', `/skill/${withFigure.skills.primary}`);
  });

  it('states why the problem is on the test', () => {
    render(<ProblemCard problem={withFigure} />);
    expect(screen.getByText(withFigure.whyOnTest)).toBeInTheDocument();
  });

  it('gives a student the whole problem without JavaScript: statement, choices, hints, solution', () => {
    const { container } = render(<ProblemCard problem={noElegant} />);
    expect(container.textContent).toContain(noElegant.statement);
    for (const choice of noElegant.choices) {
      expect(container.textContent).toContain(choice.text);
    }
    for (const hint of noElegant.hints) expect(container.textContent).toContain(hint);
    expect(container.textContent).toContain(noElegant.solutions.reliable);
    // The solution and every hint are <details>, which work with scripting switched off.
    expect(container.querySelectorAll('details').length).toBeGreaterThanOrEqual(4);
  });

  it('shows distractor-specific feedback end to end', async () => {
    render(<ProblemCard problem={withFigure} />);
    const wrong = withFigure.choices.find((c) => !c.correct);
    if (!wrong) throw new Error('malformed fixture');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${wrong.key}`) }));
    expect(screen.getByTestId('feedback')).toHaveTextContent(wrong.misconception ?? '');
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(<ProblemCard problem={withFigure} />, theme);
    expect(screen.getByText(withFigure.statement)).toBeInTheDocument();
  });
});
