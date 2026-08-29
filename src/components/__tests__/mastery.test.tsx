import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MasteryDot } from '../mastery/MasteryDot';
import { MasteryBar } from '../mastery/MasteryBar';
import { MASTERY_DISPLAY, MASTERY_LEGEND, masteryLabel } from '@/lib/mastery-display';
import { MASTERY_STATES, type MasteryState } from '@/lib/mastery';

const THEMES = ['light', 'dark'] as const;

function renderInTheme(ui: React.ReactElement, theme: (typeof THEMES)[number]) {
  document.documentElement.setAttribute('data-theme', theme);
  return render(ui);
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('the mastery vocabulary', () => {
  it('covers every state the machine can produce', () => {
    for (const state of MASTERY_STATES) {
      expect(MASTERY_DISPLAY[state], state).toBeDefined();
    }
    expect(MASTERY_LEGEND).toHaveLength(MASTERY_STATES.length);
  });

  it('renames shaky to Proficient for display only (docs/05 §3)', () => {
    expect(masteryLabel('shaky')).toBe('Proficient');
    // The internal name is unchanged: it describes what the state machine measures.
    expect(MASTERY_STATES).toContain('shaky');
  });

  it('gives every step a distinct glyph, so the ramp survives with no colour', () => {
    const icons = MASTERY_STATES.map((state) => MASTERY_DISPLAY[state].icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('walks the ramp in order', () => {
    expect(MASTERY_STATES.map((s) => MASTERY_DISPLAY[s].step)).toEqual([0, 1, 2, 3]);
    expect(MASTERY_STATES.map((s) => MASTERY_DISPLAY[s].fill)).toEqual([
      'bg-m0',
      'bg-m1',
      'bg-m2',
      'bg-m3',
    ]);
  });
});

describe('MasteryDot', () => {
  it.each(MASTERY_STATES)('names %s as well as colouring it', (state) => {
    render(<MasteryDot state={state} />);
    expect(screen.getByText(MASTERY_DISPLAY[state].label)).toBeInTheDocument();
  });

  it('carries the outline that gives it a 3:1 boundary on any surface', () => {
    // The two palest steps of the ramp cannot clear 3:1 against --surface on their own; the
    // --rule-strong outline is what makes them visible. Removing it silently breaks that.
    const { container } = render(<MasteryDot state="unseen" />);
    expect(container.querySelector('[data-mastery="unseen"]')?.className).toContain(
      'border-rule-strong',
    );
  });

  it('hides the glyph from assistive technology, which reads the name instead', () => {
    const { container } = render(<MasteryDot state="mastered" />);
    expect(container.querySelector('[data-mastery="mastered"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    renderInTheme(<MasteryDot state="seen" showLabel />, theme);
    expect(screen.getByText('Familiar')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });
});

describe('MasteryBar', () => {
  const segments: Array<{ problemId: string; state: MasteryState }> = [
    { problemId: 'KA-0001', state: 'mastered' },
    { problemId: 'KA-0002', state: 'shaky' },
    { problemId: 'KA-0003', state: 'unseen' },
    { problemId: 'KA-0004', state: 'unseen' },
  ];

  it('draws one segment per problem', () => {
    const { container } = render(<MasteryBar segments={segments} />);
    expect(container.querySelectorAll('[data-mastery]')).toHaveLength(segments.length);
  });

  it('states the score in words, because a bar does not survive a photocopy', () => {
    render(<MasteryBar segments={segments} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Progress through this skill: 1 of 4 problems solved cleanly.',
    );
  });

  it('counts every step in a legend beside it', () => {
    const { container } = render(<MasteryBar segments={segments} />);
    const legend = container.querySelector('ul')?.textContent ?? '';
    expect(legend).toContain('2Not started');
    expect(legend).toContain('1Proficient');
    expect(legend).toContain('1Mastered');
    expect(legend).toContain('0Familiar');
  });

  it('says so plainly when the skill has no problems yet', () => {
    render(<MasteryBar segments={[]} />);
    expect(screen.getByText(/No problems in this skill yet/)).toBeInTheDocument();
  });

  it.each(THEMES)('renders in the %s theme', (theme) => {
    const { container } = renderInTheme(<MasteryBar segments={segments} />, theme);
    expect(container.querySelectorAll('[data-mastery]')).toHaveLength(4);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });
});
