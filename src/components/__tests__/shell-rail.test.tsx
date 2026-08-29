import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillRail } from '../shell/SkillRail';
import type { RailStrand } from '../shell/rail-data';
import { hasRail, RAIL_ROUTES } from '@/lib/site';
import { resetProgressCache } from '../mastery/useProgress';
import { PROGRESS_KEY } from '@/lib/local-progress';

const pathname = vi.hoisted(() => ({ current: '/atlas' }));
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
  pathname.current = '/atlas';
  window.localStorage.clear();
  resetProgressCache();
});

describe('where the rail appears', () => {
  it.each(RAIL_ROUTES)('is present on %s', (route) => {
    expect(hasRail(route)).toBe(true);
    expect(hasRail(`${route}/anything`)).toBe(true);
  });

  it.each(['/', '/about', '/legal/privacy', '/contact', '/print', '/offline', '/author/new'])(
    'stays out of the way on %s',
    (route) => {
      expect(hasRail(route)).toBe(false);
    },
  );

  it('does not match a route that merely starts with the same letters', () => {
    expect(hasRail('/problems-archive')).toBe(false);
    expect(hasRail('/atlasgarden')).toBe(false);
  });

  it('renders nothing at all on a page that does not want it', () => {
    pathname.current = '/legal/privacy';
    const { container } = render(<SkillRail strands={STRANDS} />);
    expect(container.querySelector('nav')).toBeNull();
  });
});

describe('the rail', () => {
  it('groups skills by strand in collapsible sections that work without scripting', () => {
    const { container } = render(<SkillRail strands={STRANDS} />);
    const details = container.querySelectorAll('details');
    // One per strand, in the persistent rail (the drawer is not open).
    expect(details).toHaveLength(2);
    expect(details[0]?.querySelector('summary')?.textContent).toContain('Number & Arithmetic');
  });

  it('opens the strand the reader is currently inside, and only that one', () => {
    pathname.current = '/skill/CNT-12';
    const { container } = render(<SkillRail strands={STRANDS} />);
    const open = [...container.querySelectorAll('details')].filter((node) => node.open);
    expect(open).toHaveLength(1);
    expect(open[0]?.textContent).toContain('Counting');
  });

  it('opens the right strand from a strand walkthrough too', () => {
    pathname.current = '/atlas/NUM';
    const { container } = render(<SkillRail strands={STRANDS} />);
    const open = [...container.querySelectorAll('details')].filter((node) => node.open);
    expect(open[0]?.textContent).toContain('Number & Arithmetic');
  });

  it('marks the student position with aria-current, not colour alone', () => {
    pathname.current = '/skill/NUM-02';
    render(<SkillRail strands={STRANDS} />);
    const link = screen.getByRole('link', { name: /Divisibility/ });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Place value/ })).not.toHaveAttribute('aria-current');
  });

  it('carries a mastery dot on every row, named as well as coloured', () => {
    render(<SkillRail strands={STRANDS} />);
    const link = screen.getByRole('link', { name: /Place value/ });
    expect(link.textContent).toContain('Not started');
    expect(link.querySelector('[data-mastery="unseen"]')).not.toBeNull();
  });

  it('reflects stored progress rather than always showing zero', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        attempts: {
          'NUM-01': [
            {
              problemId: 'KA-1',
              points: 3,
              correct: true,
              hintsUsed: 0,
              at: '2026-03-01T10:00:00Z',
            },
            {
              problemId: 'KA-2',
              points: 3,
              correct: true,
              hintsUsed: 0,
              at: '2026-03-01T11:00:00Z',
            },
            {
              problemId: 'KA-3',
              points: 3,
              correct: true,
              hintsUsed: 0,
              at: '2026-03-02T10:00:00Z',
            },
          ],
        },
      }),
    );
    resetProgressCache();
    render(<SkillRail strands={STRANDS} />);
    expect(screen.getByRole('link', { name: /Place value/ }).textContent).toContain('Mastered');
  });

  it('always offers a way back to the whole Atlas', () => {
    render(<SkillRail strands={STRANDS} />);
    expect(screen.getByRole('link', { name: /The whole Atlas/ })).toHaveAttribute('href', '/atlas');
  });
});

describe('the drawer below 900px', () => {
  it('opens from a button and closes again', async () => {
    render(<SkillRail strands={STRANDS} />);
    const trigger = screen.getByRole('button', { name: /Skills/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Skills' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves focus into the drawer and hands it back on close', async () => {
    render(<SkillRail strands={STRANDS} />);
    const trigger = screen.getByRole('button', { name: /Skills/ });
    await userEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on Escape rather than trapping the reader', async () => {
    render(<SkillRail strands={STRANDS} />);
    await userEvent.click(screen.getByRole('button', { name: /Skills/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the page behind it from scrolling while it is open', async () => {
    render(<SkillRail strands={STRANDS} />);
    await userEvent.click(screen.getByRole('button', { name: /Skills/ }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes when the scrim is clicked', async () => {
    render(<SkillRail strands={STRANDS} />);
    await userEvent.click(screen.getByRole('button', { name: /Skills/ }));
    await userEvent.click(screen.getByTestId('rail-scrim'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
