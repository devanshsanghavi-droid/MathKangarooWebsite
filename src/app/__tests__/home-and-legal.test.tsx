import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../page';
import AboutPage from '../about/page';
import PrivacyPage from '../legal/privacy/page';
import TermsPage from '../legal/terms/page';
import LicensePage from '../legal/license/page';
import { getAllProblems, getContentStats, getStrandSummaries } from '@/lib/content';
import { BANDS } from '@/lib/schemas';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { resetLevelMemory } from '@/lib/level-pref';
import { DISCLAIMER } from '@/lib/site';

const stats = getContentStats();

describe('/ - the Practice home', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetProgressCache();
    resetLevelMemory();
  });

  it('leads a new visitor with the thesis, not with a feature list', () => {
    render(HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Math Kangaroo preparation organised by skill, not by year.',
    );
  });

  it('offers the four quick starts, with no sign-in prompt', () => {
    const { container } = render(HomePage());
    const quick = screen.getByRole('region', { name: 'Quick start' });
    for (const name of ['Diagnostic', 'Mock test', 'Random unsolved', 'Start a skill']) {
      expect(within(quick).getByRole('heading', { level: 3, name })).toBeInTheDocument();
    }
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/practice/diagnostic');
    expect(hrefs).toContain('/practice/mock');
    expect(hrefs).toContain('/problems');
    expect(hrefs).toContain('/atlas');
    expect(container.textContent).not.toMatch(/sign in/i);
  });

  it('has a level picker that remembers the level in this browser', async () => {
    render(HomePage());
    const levels = screen.getByRole('region', { name: 'Pick your level' });
    const button = within(levels).getByRole('button', { name: /Level 5-6/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(window.localStorage.getItem('ka-level')).toBe('5-6');
    expect(within(levels).getByRole('button', { name: /Level 5-6/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows every level with its problem count, counted from the bank', () => {
    render(HomePage());
    const levels = screen.getByRole('region', { name: 'Pick your level' });
    for (const band of BANDS) {
      const total = getAllProblems().filter((p) => p.band === band).length;
      expect(
        within(levels).getByRole('button', { name: new RegExp(`Level ${band}\\b`) }),
      ).toHaveTextContent(`0 / ${total} solved`);
    }
  });

  it('shows all seven strands with skill counts and a progress bar each', () => {
    render(HomePage());
    const panel = screen.getByRole('region', { name: 'Seven strands' });
    for (const strand of getStrandSummaries()) {
      expect(panel.textContent, strand.strand).toContain(strand.name);
      expect(panel.textContent, strand.strand).toContain(`${strand.skillCount} skills`);
    }
    expect(within(panel).getAllByRole('progressbar')).toHaveLength(7);
  });

  it('shows a problem of the day that links to the problem', () => {
    render(HomePage());
    const card = screen.getByRole('region', { name: 'Problem of the day' });
    expect(card.querySelector('a[href^="/problem/KA-"]')).not.toBeNull();
  });

  it('counts only what it can count, and defines every counter', () => {
    const { container } = render(HomePage());
    expect(container.textContent).toContain(String(stats.skills));
    expect(container.textContent).toContain(String(stats.problems));
    expect(container.textContent).toContain(String(stats.misconceptions));
    expect(container.textContent).toMatch(/One per wrong answer choice/);
  });

  it('does not invent a students-served figure', () => {
    const { container } = render(HomePage());
    expect(container.textContent).toMatch(/fewer than\s+ten students is published at all/);
  });

  it('greets a returning student with a Continue card and their own counts', () => {
    const problem = getAllProblems()[0];
    if (!problem) throw new Error('empty bank');
    const at = new Date().toISOString();
    window.localStorage.setItem(
      'ka-progress',
      JSON.stringify({
        version: 1,
        attempts: {
          [problem.skills.primary]: [
            { problemId: problem.id, points: problem.points, correct: true, hintsUsed: 0, at },
          ],
        },
      }),
    );
    render(HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back');
    expect(screen.getByRole('heading', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the skill/ })).toHaveAttribute(
      'href',
      `/skill/${problem.skills.primary}`,
    );
    expect(screen.getByRole('region', { name: 'Solved by level' })).toHaveTextContent(
      `1 / ${getAllProblems().filter((p) => p.band === problem.band).length} solved`,
    );
    // Counts, never points or badges.
    expect(document.body.textContent).not.toMatch(/\bXP\b|badge|leaderboard/i);
  });
});

describe('/about', () => {
  it('is written in the first person', () => {
    const { container } = render(AboutPage());
    // textContent concatenates without spaces, so no word boundary before the "I".
    expect(container.textContent).toMatch(/I tutor about sixty students a year/);
    expect(container.textContent).toMatch(/I was doing the diagnosis in my head/);
  });

  it('states the four things the site will never do', () => {
    const { container } = render(AboutPage());
    for (const promise of [
      /Charge for anything/,
      /Require an account to practise/,
      /Track you/,
      /Reproduce an official/,
    ]) {
      expect(container.textContent, String(promise)).toMatch(promise);
    }
  });
});

describe('/legal/privacy', () => {
  it('lists exactly what an account holds', () => {
    const { container } = render(PrivacyPage());
    for (const item of ['A first name', 'A level', 'Which problems were attempted']) {
      expect(container.textContent).toContain(item);
    }
  });

  it('names what is never stored', () => {
    const { container } = render(PrivacyPage());
    expect(container.textContent).toMatch(/No last name\. No school\. No address\. No birthday\./);
  });

  it('promises a hard delete, not a soft one', () => {
    const { container } = render(PrivacyPage());
    expect(container.textContent).toMatch(/rows are removed, not\s+flagged as hidden/);
  });

  it('says there are no third-party trackers or cookies', () => {
    const { container } = render(PrivacyPage());
    expect(container.textContent).toMatch(/no third-party analytics/i);
    expect(container.textContent).toMatch(/cookie-free/i);
  });
});

describe('/legal/terms', () => {
  it('carries the non-affiliation statement in the body, not only the footer', () => {
    const { container } = render(TermsPage());
    expect(container.textContent).toContain(DISCLAIMER);
  });

  it('says no official problem is reproduced', () => {
    const { container } = render(TermsPage());
    expect(container.textContent).toMatch(/No official\s+problem, figure or answer is reproduced/);
  });
});

describe('/legal/license', () => {
  it('names both licences and what each covers', () => {
    const { container } = render(LicensePage());
    expect(container.textContent).toMatch(/The code: MIT/);
    expect(container.textContent).toMatch(/CC BY-NC-SA 4\.0/);
  });

  it('is explicit that the official problems are covered by neither', () => {
    const { container } = render(LicensePage());
    expect(container.textContent).toMatch(/What neither licence covers/);
    expect(container.textContent).toMatch(/nothing here grants any right to them/);
  });
});
