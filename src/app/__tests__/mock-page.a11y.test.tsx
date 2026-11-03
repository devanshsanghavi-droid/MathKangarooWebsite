import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import { MockRunner } from '@/components/practice/MockRunner';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { MOCK_DURATION_MS, itemsPerTier, startMock, type MockState } from '@/lib/mock';
import { BANDS, POINT_VALUES } from '@/lib/schemas';

const problems = getAllProblems();
const props = {
  problems,
  skillNames: Object.fromEntries(getAllSkills().map((s) => [s.id, s.name])),
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

async function startPaper() {
  render(<MockRunner {...props} />);
  await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
}

describe('starting a mock', () => {
  it('offers every level the bank can fill', async () => {
    // The bank now fills all six, so this asserts the offer rather than the gap. The levels
    // are derived from the bank, not listed, so authoring more problems cannot stale it.
    render(<MockRunner {...props} />);
    await screen.findByRole('button', { name: /Level 3–4/ });
    for (const band of BANDS) {
      const label = new RegExp(`Level ${band.replace('-', '[-–]')}`);
      const fillable = POINT_VALUES.every(
        (points) =>
          problems.filter((p) => p.band === band && p.points === points).length >=
          itemsPerTier(band),
      );
      expect(Boolean(screen.queryByRole('button', { name: label })), `${band}`).toBe(fillable);
    }
  });

  it('says why a thin level is missing rather than hiding it', async () => {
    // Thinned on purpose: the explanation only has to appear when a level is short, and every
    // level the real bank holds is now full.
    const thinned = problems.filter((p) => !(p.band === '11-12' && p.points === 5));
    const { container } = render(<MockRunner {...props} problems={thinned} />);
    await screen.findByRole('button', { name: /Level 3–4/ });
    expect(container.textContent).toMatch(/A short paper scored\s+out of the full total/);
  });

  it('states that a wrong answer costs nothing, before the paper starts', async () => {
    const { container } = render(<MockRunner {...props} />);
    await screen.findByRole('button', { name: /Level 3–4/ });
    expect(container.textContent).toMatch(/nothing deducted for a wrong answer/i);
  });
});

describe('sitting the paper', () => {
  it('shows a timer, a question, and a navigator', async () => {
    await startPaper();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /question navigator/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /answer choices/i })).toBeInTheDocument();
  });

  it('never shows hints, the solution, or whether an answer was right', async () => {
    const { container } = await startPaper().then(() => ({
      container: document.body,
    }));
    expect(container.textContent).not.toMatch(/A nudge|The full solution/);
    expect(container.textContent).not.toMatch(/Why this is on the test/);
    expect(screen.queryByTestId('feedback')).toBeNull();
  });

  it('records an answer and says so', async () => {
    await startPaper();
    const choices = within(screen.getByRole('group', { name: /answer choices/i })).getAllByRole(
      'button',
    );
    await userEvent.click(choices[1] as HTMLElement);
    expect(screen.getByText(/^Answered/)).toBeInTheDocument();
  });

  it('flags a question for review and marks it in the navigator', async () => {
    await startPaper();
    await userEvent.click(screen.getByRole('button', { name: /^Flag for review$/ }));
    expect(screen.getByRole('button', { name: /Flagged for review/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const nav = screen.getByRole('navigation', { name: /question navigator/i });
    expect(
      within(nav).getByRole('button', { name: /Question 1, blank, flagged/ }),
    ).toBeInTheDocument();
  });

  it('names every navigator button with its state, for a screen reader', async () => {
    await startPaper();
    const nav = screen.getByRole('navigation', { name: /question navigator/i });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons).toHaveLength(30);
    expect(buttons[0]).toHaveAttribute('aria-label', expect.stringContaining('Question 1'));
    expect(buttons[0]).toHaveAttribute('aria-label', expect.stringContaining('blank'));
  });

  it('jumps to a question from the navigator', async () => {
    await startPaper();
    const nav = screen.getByRole('navigation', { name: /question navigator/i });
    await userEvent.click(within(nav).getByRole('button', { name: /Question 12/ }));
    expect(screen.getByText(/Question 12 of 30/)).toBeInTheDocument();
  });

  it('saves the run so a refresh does not lose it', async () => {
    await startPaper();
    const saved = window.localStorage.getItem('ka-mock');
    expect(saved).toBeTruthy();
    const state = JSON.parse(saved ?? '{}') as MockState;
    expect(state.problemIds).toHaveLength(30);
    expect(state.startedAt).toBeTruthy();
  });

  it('restores a run in progress with the timer still running - M2.8 acceptance', async () => {
    // A paper started 40 minutes ago must come back with 35 minutes left, not 75.
    const started = startMock(problems, '5-6', 1, new Date(Date.now() - 40 * 60_000));
    if (!started) throw new Error('cannot build a 5-6 paper');
    const firstId = started.problemIds[0];
    if (firstId && started.answers[firstId]) started.answers[firstId].chosenKey = 'B';
    window.localStorage.setItem('ka-mock', JSON.stringify(started));

    render(<MockRunner {...props} />);
    const timer = await screen.findByRole('timer');
    const minutes = Number((timer.textContent ?? '0:00').split(':')[0]);
    expect(minutes).toBeGreaterThanOrEqual(34);
    expect(minutes).toBeLessThanOrEqual(35);
    expect(screen.getByText(/^Answered/)).toBeInTheDocument();
  });

  it('nudges about blanks in the last five minutes', async () => {
    const started = startMock(
      problems,
      '5-6',
      1,
      new Date(Date.now() - (MOCK_DURATION_MS - 4 * 60_000)),
    );
    if (!started) throw new Error('cannot build a 5-6 paper');
    window.localStorage.setItem('ka-mock', JSON.stringify(started));

    render(<MockRunner {...props} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Five minutes left/);
    expect(alert).toHaveTextContent(/A wrong answer costs nothing/);
  });

  it('submits automatically when the time is up', async () => {
    const started = startMock(problems, '5-6', 1, new Date(Date.now() - MOCK_DURATION_MS - 1000));
    if (!started) throw new Error('cannot build a 5-6 paper');
    window.localStorage.setItem('ka-mock', JSON.stringify(started));

    render(<MockRunner {...props} />);
    expect(await screen.findByText(/Your paper/)).toBeInTheDocument();
  });
});

describe('the report', () => {
  async function finishPaper() {
    await startPaper();
    await userEvent.click(screen.getByRole('button', { name: /Finish now/ }));
    return screen.findByText(/Your paper/);
  }

  it('reports a score out of the right total', async () => {
    await finishPaper();
    expect(screen.getByText('/ 120')).toBeInTheDocument();
  });

  it('says what the blanks cost, which is the whole point of the no-penalty rule', async () => {
    const { container } = await finishPaper().then(() => ({ container: document.body }));
    expect(container.textContent).toMatch(/You left\s+30\s+blank, worth 120 points/);
  });

  it('breaks the score down by point tier', async () => {
    await finishPaper();
    expect(screen.getByText(/By point tier/)).toBeInTheDocument();
  });

  it('draws the time-against-outcome scatter with an accessible description', async () => {
    await finishPaper();
    const chart = screen.getByRole('img', { name: /Time against outcome/ });
    expect(chart).toBeInTheDocument();
  });

  it('names the three skills to fix first', async () => {
    await finishPaper();
    expect(screen.getByText(/The three to fix first/)).toBeInTheDocument();
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/skill/'));
    expect(links.length).toBeGreaterThan(0);
  });

  it('lists every question with its answer, behind a disclosure', async () => {
    await finishPaper();
    await userEvent.click(screen.getByText(/Every question, with the answer/));
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/problem/'));
    expect(links).toHaveLength(30);
  });
});

describe('accessibility', () => {
  it('has no axe violations at the start, in either theme', async () => {
    const { container } = render(<MockRunner {...props} />);
    await screen.findByRole('button', { name: /Level 3–4/ });
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations while sitting the paper, in either theme', async () => {
    const { container } = render(<MockRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations on the report, in either theme', async () => {
    const { container } = render(<MockRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    await userEvent.click(screen.getByRole('button', { name: /Finish now/ }));
    await screen.findByText(/Your paper/);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
