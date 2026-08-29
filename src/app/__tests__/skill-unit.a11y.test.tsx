import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import SkillLearnPage from '../skill/[id]/learn/page';
import LadderPage from '../skill/[id]/practice/[tier]/page';
import SkillQuizPage from '../skill/[id]/quiz/page';
import { resetProgressCache } from '@/components/mastery/useProgress';

/** A sample that covers each shape these pages can take, rather than all 91 every run. */
const SAMPLE = ['CNT-12', 'NUM-01', 'CFT-12', 'GEO-10'];

beforeEach(() => {
  window.localStorage.clear();
  resetProgressCache();
});

describe('the learn page', () => {
  it.each(SAMPLE)('%s has no axe violations in either theme', async (id) => {
    const { container } = render(await SkillLearnPage({ params: Promise.resolve({ id }) }));
    expect(await auditBothThemes(container)).toEqual([]);
  });
});

describe('the exercise view', () => {
  it.each(['3', '4', '5'])('the %s-point ladder has no axe violations', async (tier) => {
    const { container } = render(
      await LadderPage({ params: Promise.resolve({ id: 'CNT-12', tier }) }),
    );
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('is still clean once feedback and a hint are on screen', async () => {
    const { container } = render(
      await LadderPage({ params: Promise.resolve({ id: 'CNT-12', tier: '3' }) }),
    );
    const group = within(container).getByRole('group', { name: /answer choices/i });
    await userEvent.click(within(group).getAllByRole('button')[0] as HTMLElement);
    await userEvent.click(within(container).getByRole('button', { name: /Show a hint/ }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('keeps every answer choice at least 44px tall and keyboard operable (docs/05 §6 and §9)', async () => {
    const { container } = render(
      await LadderPage({ params: Promise.resolve({ id: 'CNT-12', tier: '3' }) }),
    );
    const group = within(container).getByRole('group', { name: /answer choices/i });
    const choices = within(group).getAllByRole('button');
    expect(choices).toHaveLength(5);
    for (const choice of choices) {
      // jsdom has no layout, so the height is asserted through the class that sets it.
      expect(choice.className).toContain('tap-target');
      expect(choice.className).toContain('border-2');
    }
    // Every choice is a real button, so each is a tab stop; arrow keys move between them.
    (choices[0] as HTMLElement).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(choices[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(choices[4]).toHaveFocus();
  });
});

describe('the skill quiz', () => {
  it('has no axe violations before or after it is marked', async () => {
    const { container } = render(
      await SkillQuizPage({ params: Promise.resolve({ id: 'CNT-12' }) }),
    );
    expect(await auditBothThemes(container)).toEqual([]);

    const groups = screen.getAllByRole('group', { name: /answer choices/i });
    for (const group of groups) {
      await userEvent.click(within(group).getAllByRole('button')[0] as HTMLElement);
    }
    await userEvent.click(screen.getByRole('button', { name: /Finish and see the explanations/ }));
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
