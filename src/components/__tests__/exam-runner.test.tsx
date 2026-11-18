import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AmcMockApp, AmcSectionApp } from '../exam-runner/AmcExams';
import { TestMockApp } from '../exam-runner/TestExams';
import { KaSectionApp } from '../exam-runner/KaSectionApp';
import { MathProvider } from '../math/MathProvider';
import { MockRunner } from '../practice/MockRunner';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { toAssessmentProblem } from '@/lib/assessment';
import { getAllAmcProblems } from '@/lib/amc-content';
import { buildAmcIndex } from '@/lib/bank-data';
import { buildAmcMockPaper } from '@/lib/exam-papers';
import { EXAM_SPECS, startExam, type ExamState } from '@/lib/exam-engine';
import { readProgress } from '@/lib/local-progress';
import { installExamData } from '../../../test/exam-fixtures';

vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const MIN = 60_000;

beforeEach(() => {
  window.localStorage.clear();
  installExamData();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function navigator() {
  return screen.getByRole('navigation', { name: /question navigator/i });
}

function choice(key: string) {
  const group = screen.getByRole('group', { name: /answer choices/i });
  const button = within(group)
    .getAllByRole('button')
    .find((b) => b.textContent?.trim().startsWith(key));
  if (!button) throw new Error(`no choice ${key}`);
  return button;
}

function savedAmc10(minutesAgo: number): ExamState {
  const paper = buildAmcMockPaper(buildAmcIndex(getAllAmcProblems()).rows, 'AMC10', 5);
  if (paper.shortfall > 0) throw new Error('the AMC bank cannot fill an AMC 10 paper');
  const state = startExam({
    kind: 'mock',
    exam: 'AMC10',
    title: 'AMC 10 mock',
    seed: 5,
    problemIds: paper.problemIds,
    modules: EXAM_SPECS.AMC10.mock ?? [],
    now: new Date(Date.now() - minutesAgo * MIN),
  });
  window.localStorage.setItem('ka-exam:amc-mock', JSON.stringify(state));
  return state;
}

async function startAmc10() {
  const user = userEvent.setup();
  render(
    <MathProvider>
      <AmcMockApp />
    </MathProvider>,
  );
  await user.click(await screen.findByRole('button', { name: /Start AMC 10/ }));
  await screen.findByRole('timer');
  return user;
}

describe('the AMC mock', () => {
  it('offers the papers and says how each is scored', async () => {
    render(<AmcMockApp />);
    const start = await screen.findByRole('button', { name: /Start AMC 10/ });
    expect(start).toHaveTextContent(/25 questions, 75 minutes, 6 per right answer, 1.5 per blank/);
    expect(document.body.textContent).toMatch(/AMC 8/);
  });

  it('sits a 25-question paper with a timer, a navigator and no answers on show', async () => {
    await startAmc10();
    expect(within(navigator()).getAllByRole('button')).toHaveLength(25);
    expect(screen.getByRole('heading', { name: 'Question 1' })).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/7[45]:\d\d/);
    expect(document.body.textContent).not.toMatch(/The reliable way|thinking that leads/);
  });

  it('records an answer, flags a question, and saves the run', async () => {
    const user = await startAmc10();
    await user.click(choice('B'));
    expect(screen.getByText(/^Answered/)).toHaveTextContent('Answered B');
    await user.click(screen.getByRole('button', { name: 'Flag for review' }));
    expect(
      within(navigator()).getByRole('button', { name: 'Question 1, answered, flagged' }),
    ).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('ka-exam:amc-mock') ?? '{}') as ExamState;
    expect(saved.problemIds).toHaveLength(25);
    expect(Object.values(saved.answers).filter((a) => a.chosenKey === 'B')).toHaveLength(1);
  });

  it('moves with the navigator and Next', async () => {
    const user = await startAmc10();
    await user.click(within(navigator()).getByRole('button', { name: /^Question 12,/ }));
    expect(screen.getByRole('heading', { name: 'Question 12' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Question 13' })).toBeInTheDocument();
  });

  it('asks before submitting, and Keep working returns to the paper', async () => {
    const user = await startAmc10();
    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    expect(screen.getByRole('heading', { name: 'Submit the test?' })).toHaveFocus();
    expect(document.body.textContent).toMatch(/25 questions are still blank/);
    await user.click(screen.getByRole('button', { name: 'Keep working' }));
    expect(screen.queryByRole('heading', { name: 'Submit the test?' })).toBeNull();
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('scores 6 / 1.5 / 0 out of 150, and records the attempt and the session', async () => {
    const user = await startAmc10();
    await user.click(choice('B'));
    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    await user.click(screen.getByRole('button', { name: 'Submit and see my score' }));
    expect(await screen.findByRole('heading', { name: /Your result: AMC 10 mock/ })).toHaveFocus();
    expect(screen.getByText('/ 150')).toBeInTheDocument();

    await waitFor(() => expect(readProgress().sessions ?? []).toHaveLength(1));
    const progress = readProgress();
    const session = progress.sessions?.[0];
    expect(session).toMatchObject({ kind: 'mock', exam: 'AMC10', max: 150, total: 25 });
    // One answered question: 6 if right, 0 if wrong, and 1.5 for each of the 24 blanks.
    expect([36, 42]).toContain(session?.score);
    const amcAttempts = Object.entries(progress.attempts).filter(([key]) => key.startsWith('AM-'));
    expect(amcAttempts).toHaveLength(1);
  });

  it('breaks the result down by area and links the weakest to section tests', async () => {
    const user = await startAmc10();
    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    await user.click(screen.getByRole('button', { name: 'Submit and see my score' }));
    await screen.findByRole('heading', { name: /Your result/ });
    expect(screen.getByRole('heading', { name: 'By area' })).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
    const focus = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/amc/section?contest=AMC10&area='));
    expect(focus.length).toBeGreaterThan(0);
    expect(focus.length).toBeLessThanOrEqual(3);
    // All 25 blank, so all 25 are listed with their solutions.
    expect(screen.getByRole('heading', { name: 'Questions you missed (25)' })).toBeInTheDocument();
    expect(screen.getAllByText(/You left this blank/)).toHaveLength(25);
  });

  it('records a finished paper only once, even after a refresh on the report', async () => {
    const user = await startAmc10();
    await user.click(choice('A'));
    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    await user.click(screen.getByRole('button', { name: 'Submit and see my score' }));
    await screen.findByRole('heading', { name: /Your result/ });
    await waitFor(() => expect(readProgress().sessions ?? []).toHaveLength(1));
    await waitFor(() =>
      expect(
        (JSON.parse(window.localStorage.getItem('ka-exam:amc-mock') ?? '{}') as ExamState).recorded,
      ).toBe(true),
    );
    // "Refresh".
    document.body.innerHTML = '';
    render(<AmcMockApp />);
    await screen.findByRole('heading', { name: /Your result/ });
    expect(readProgress().sessions ?? []).toHaveLength(1);
  });

  it('restores a paper in progress with the timer still running', async () => {
    savedAmc10(40);
    render(<AmcMockApp />);
    const timer = await screen.findByRole('timer');
    const minutes = Number((timer.textContent ?? '0:00').split(':')[0]);
    expect(minutes).toBeGreaterThanOrEqual(34);
    expect(minutes).toBeLessThanOrEqual(35);
  });

  it('nudges about blanks in the last five minutes, with the AMC 10 guessing rule', async () => {
    savedAmc10(71);
    render(<AmcMockApp />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Five minutes left, and 25 questions are blank/);
    expect(alert).toHaveTextContent(/rule out at least two choices/);
  });

  it('submits when the time is up', async () => {
    savedAmc10(76);
    render(<AmcMockApp />);
    expect(await screen.findByRole('heading', { name: /Your result/ })).toBeInTheDocument();
  });

  it('hides and shows the timer', async () => {
    const user = await startAmc10();
    await user.click(screen.getByRole('button', { name: 'Hide timer' }));
    expect(screen.queryByRole('timer')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show timer' }));
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });
});

describe('the SAT mock', () => {
  it('runs two modules of 22, closes the first, and estimates a scaled score', async () => {
    const user = userEvent.setup();
    render(<TestMockApp test="SAT" />);
    await user.click(await screen.findByRole('button', { name: /Start the SAT Math mock/ }));
    await screen.findByRole('timer');
    expect(screen.getByText(/Module 1 of 2: Question 1 of 22/)).toBeInTheDocument();
    expect(within(navigator()).getAllByRole('button')).toHaveLength(22);

    await user.click(choice('A'));
    await user.click(screen.getByRole('button', { name: 'Submit module 1' }));
    expect(screen.getByRole('heading', { name: 'Submit module 1?' })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/cannot come back to this module/);
    await user.click(screen.getByRole('button', { name: 'Submit and start module 2' }));

    expect(await screen.findByText(/Module 2 has started/)).toBeInTheDocument();
    expect(screen.getByText(/Module 2 of 2: Question 1 of 22/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Module 2, question 1' })).toBeInTheDocument();
    expect(within(navigator()).getAllByRole('button')).toHaveLength(22);

    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    await user.click(screen.getByRole('button', { name: 'Submit and see my score' }));
    await screen.findByRole('heading', { name: /Your result: SAT Math mock/ });
    expect(screen.getByText('/ 44')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Estimated SAT Math score: about \d+ to \d+/);
    expect(document.body.textContent).toMatch(/This is an estimate, not an official score/);
    await waitFor(() =>
      expect(readProgress().sessions?.[0]).toMatchObject({
        exam: 'SAT',
        kind: 'mock',
        correct: 1,
        total: 44,
        score: 1,
        max: 44,
      }),
    );
    expect(Object.keys(readProgress().attempts).some((key) => key.startsWith('sat:'))).toBe(true);
  });

  it('shows the misconception behind a wrong pick in the report', async () => {
    const user = userEvent.setup();
    render(<TestMockApp test="SAT" />);
    await user.click(await screen.findByRole('button', { name: /Start the SAT Math mock/ }));
    await screen.findByRole('timer');
    await user.click(choice('C'));
    await user.click(screen.getByRole('button', { name: 'Submit module 1' }));
    await user.click(screen.getByRole('button', { name: 'Submit and start module 2' }));
    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    await user.click(screen.getByRole('button', { name: 'Submit and see my score' }));
    await screen.findByRole('heading', { name: /Your result/ });
    expect(screen.getByText(/The thinking that leads to C/)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/I added the wrong numbers and got 4/);
  });
});

describe('section tests', () => {
  it('Kangaroo: picks a level and strand, times it from the estimates, and links skills', async () => {
    const user = userEvent.setup();
    render(<KaSectionApp />);
    const start = await screen.findByRole('button', { name: 'Start the section test' });
    // Find a level and strand the bank can fill.
    const level = screen.getByLabelText('Level') as HTMLSelectElement;
    const strand = screen.getByLabelText('Strand') as HTMLSelectElement;
    outer: for (const band of [...level.options].map((o) => o.value)) {
      await user.selectOptions(level, band);
      for (const s of [...strand.options].map((o) => o.value)) {
        await user.selectOptions(strand, s);
        if (!(start as HTMLButtonElement).disabled) break outer;
      }
    }
    expect(start).toBeEnabled();
    await user.click(start);
    await screen.findByRole('timer');
    const saved = JSON.parse(
      window.localStorage.getItem('ka-exam:ka-section') ?? '{}',
    ) as ExamState;
    expect(saved.kind).toBe('section');
    expect(saved.problemIds.length).toBeGreaterThanOrEqual(5);
    expect(saved.problemIds.length).toBeLessThanOrEqual(10);
    expect(saved.modules[0]?.durationMs ?? 0).toBeGreaterThan(0);
    expect((saved.modules[0]?.durationMs ?? 0) % MIN).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    await user.click(screen.getByRole('button', { name: 'Submit and see my score' }));
    await screen.findByRole('heading', { name: /Your result/ });
    expect(screen.getByRole('heading', { name: 'By skill' })).toBeInTheDocument();
    const skills = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/skill/'));
    expect(skills.length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(readProgress().sessions?.[0]).toMatchObject({
        kind: 'section',
        exam: 'KA',
        section: saved.section,
      }),
    );
  });

  it('AMC: preselects the paper and area named in the link', async () => {
    window.history.replaceState(null, '', '/amc/section?contest=AMC12&area=GEO');
    render(<AmcSectionApp />);
    await screen.findByRole('button', { name: 'Start the section test' });
    await waitFor(() => expect(screen.getByLabelText('Paper')).toHaveValue('AMC12'));
    expect(screen.getByLabelText('Area')).toHaveValue('GEO');
  });

  it('AMC: says why a thin section has no test', async () => {
    window.history.replaceState(null, '', '/amc/section?contest=AMC8&area=GEO');
    render(<AmcSectionApp />);
    await screen.findByRole('button', { name: 'Start the section test' });
    await waitFor(() => expect(screen.getByLabelText('Paper')).toHaveValue('AMC8'));
    const start = screen.getByRole('button', { name: 'Start the section test' });
    if ((start as HTMLButtonElement).disabled) {
      expect(document.body.textContent).toMatch(/a section test needs at least 5/);
    } else {
      expect(document.body.textContent).toMatch(/questions, timed from how long/);
    }
  });
});

describe('the Kangaroo mock at /practice/mock', () => {
  it('records the answered questions and the paper as a session, once', async () => {
    const user = userEvent.setup();
    const problems = getAllProblems().map(toAssessmentProblem);
    const skillNames = Object.fromEntries(getAllSkills().map((s) => [s.id, s.name]));
    render(<MockRunner problems={problems} skillNames={skillNames} />);
    await user.click(await screen.findByRole('button', { name: /Level 5-6/ }));
    await user.click(choice('B'));
    await user.click(screen.getByRole('button', { name: /Finish now/ }));
    await screen.findByText(/Your paper/);
    await waitFor(() => expect(readProgress().sessions ?? []).toHaveLength(1));
    expect(readProgress().sessions?.[0]).toMatchObject({
      kind: 'mock',
      exam: 'KA',
      total: 30,
      max: 120,
    });
    const attempts = Object.values(readProgress().attempts).flat();
    expect(new Set(attempts.map((a) => a.problemId)).size).toBe(1);
    await waitFor(() =>
      expect(
        (JSON.parse(window.localStorage.getItem('ka-mock') ?? '{}') as { recorded?: boolean })
          .recorded,
      ).toBe(true),
    );
  });
});
