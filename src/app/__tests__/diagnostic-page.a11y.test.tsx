import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import { DiagnosticRunner } from '@/components/practice/DiagnosticRunner';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { toAssessmentProblem, toAssessmentSkill } from '@/lib/assessment';

const skills = getAllSkills();
// The trimmed bank, exactly as /practice/diagnostic passes it.
const problems = getAllProblems().map(toAssessmentProblem);
const props = {
  content: { skills: skills.map(toAssessmentSkill), problems },
  skillNames: Object.fromEntries(skills.map((s) => [s.id, s.name])),
};

beforeEach(() => {
  window.localStorage.clear();
});

/** Answer every question with the given letter until the diagnostic ends. */
async function runThrough(pick: (index: number) => string) {
  let index = 0;
  for (let guard = 0; guard < 40; guard += 1) {
    const group = screen.queryByRole('group', { name: /answer choices/i });
    if (!group) break;
    const buttons = within(group).getAllByRole('button');
    const wanted = pick(index);
    const target =
      buttons.find((button) => button.textContent?.trim().startsWith(wanted)) ?? buttons[0];
    if (!target) break;
    await userEvent.click(target);
    index += 1;
  }
  return index;
}

describe('the diagnostic', () => {
  it('offers a level to start at, with no sign-in anywhere', async () => {
    render(<DiagnosticRunner {...props} />);
    expect(await screen.findByText(/Which level do you sit/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Level 5–6/ })).toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });

  it('says plainly that nothing is sent anywhere', async () => {
    const { container } = render(<DiagnosticRunner {...props} />);
    await screen.findByText(/Which level do you sit/);
    expect(container.textContent).toMatch(/No account, no sign-in, nothing sent anywhere/);
  });

  it('asks a question once a level is chosen', async () => {
    render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: /answer choices/i });
    expect(within(group).getAllByRole('button')).toHaveLength(5);
  });

  it('never tells the student whether an answer was right, mid-run', async () => {
    const { container } = render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    const choices = within(screen.getByRole('group', { name: /answer choices/i })).getAllByRole(
      'button',
    );
    await userEvent.click(choices[0] as HTMLElement);
    expect(screen.queryByTestId('feedback')).toBeNull();
    expect(container.textContent).not.toMatch(/your answer/);
  });

  it('shows no hints and no solution during the run - it is a measurement', async () => {
    // Rendering the full practice card here would let a student open the worked solution
    // mid-diagnostic, which would measure nothing at all.
    const { container } = render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    expect(container.textContent).not.toMatch(/A nudge|The strategy|The full solution/);
    expect(container.querySelector('details')).toBeNull();
    expect(container.textContent).not.toMatch(/Why this is on the test/);
  });

  it('reaches a result and reports every strand', async () => {
    render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    const answered = await runThrough(() => 'A');
    expect(answered).toBeGreaterThan(0);
    expect(await screen.findByText(/Your map/)).toBeInTheDocument();
    expect(screen.getByText(/Strand by strand/)).toBeInTheDocument();
    expect(screen.getByText(/Six weeks, in order/)).toBeInTheDocument();
  });

  it('saves progress so the tab can be closed', async () => {
    render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 3–4/ }));
    const buttons = within(screen.getByRole('group', { name: /answer choices/i })).getAllByRole(
      'button',
    );
    await userEvent.click(buttons[0] as HTMLElement);
    const saved = window.localStorage.getItem('ka-diagnostic');
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved ?? '{}').state.answers).toHaveLength(1);
  });

  it('offers to resume a saved run rather than silently restarting', async () => {
    window.localStorage.setItem(
      'ka-diagnostic',
      JSON.stringify({
        state: {
          band: '5-6',
          answers: [
            { problemId: 'KA-0001', skillId: 'CNT-12', strand: 'CNT', points: 3, correct: true },
          ],
          frontier: Object.fromEntries(
            ['NUM', 'CNT', 'GEO', 'LOG', 'PAT', 'MOD', 'CFT'].map((s) => [
              s,
              { skillId: null, points: 3, bounded: true },
            ]),
          ),
        },
        savedAt: '2026-03-01T00:00:00Z',
      }),
    );
    render(<DiagnosticRunner {...props} />);
    expect(await screen.findByText(/diagnostic in progress/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Carry on/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard it/ })).toBeInTheDocument();
  });

  it('has an accessible progress indicator', async () => {
    render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '15');
    expect(bar).toHaveAttribute('aria-label', 'Diagnostic progress');
  });

  it('has no axe violations at the start, in either theme', async () => {
    const { container } = render(<DiagnosticRunner {...props} />);
    await screen.findByText(/Which level do you sit/);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations mid-run, in either theme', async () => {
    const { container } = render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations on the result, in either theme', async () => {
    const { container } = render(<DiagnosticRunner {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: /Level 5–6/ }));
    await runThrough(() => 'A');
    await screen.findByText(/Your map/);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
