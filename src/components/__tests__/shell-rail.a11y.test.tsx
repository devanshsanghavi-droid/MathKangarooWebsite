import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import { SkillRail } from '../shell/SkillRail';
import type { RailStrand } from '../shell/rail-data';
import { resetProgressCache } from '../mastery/useProgress';

const pathname = vi.hoisted(() => ({ current: '/skill/CNT-12' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

const STRANDS: RailStrand[] = [
  {
    strand: 'NUM',
    name: 'Number & Arithmetic',
    skills: [
      { id: 'NUM-01', name: 'Place value', tier: 'foundation', problemCount: 3 },
      { id: 'NUM-02', name: 'Divisibility', tier: 'core', problemCount: 2 },
    ],
  },
  {
    strand: 'CNT',
    name: 'Counting',
    skills: [{ id: 'CNT-12', name: 'Sliding a shape', tier: 'core', problemCount: 4 }],
  },
];

beforeEach(() => {
  pathname.current = '/skill/CNT-12';
  window.localStorage.clear();
  resetProgressCache();
});

describe('the skill rail', () => {
  it('has no axe violations in either theme', async () => {
    const { container } = render(<SkillRail strands={STRANDS} />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with the drawer open', async () => {
    const { container } = render(<SkillRail strands={STRANDS} />);
    await userEvent.click(screen.getByRole('button', { name: /Skills/ }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('is reachable and operable with the keyboard alone (docs/05 §9)', async () => {
    render(<SkillRail strands={STRANDS} />);
    const trigger = screen.getByRole('button', { name: /Skills/ });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: 'Skills' })).toBeInTheDocument();
    // Tab stays inside the drawer rather than escaping to the page behind it.
    await userEvent.tab();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });
});
