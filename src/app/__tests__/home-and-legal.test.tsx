import { beforeEach, describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../page';
import AboutPage from '../about/page';
import PrivacyPage from '../legal/privacy/page';
import TermsPage from '../legal/terms/page';
import LicensePage from '../legal/license/page';
import { getAllProblems, getContentStats } from '@/lib/content';
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

  it('opens a first visit with a short, plain introduction', () => {
    render(HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Get ready for Math Kangaroo, one skill at a time.',
    );
    const how = screen.getByRole('region', { name: 'Three steps, no sign-up' });
    expect(within(how).getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  it('does not show the progress dashboard to a first-time visitor', () => {
    render(HomePage());
    expect(screen.queryByRole('region', { name: 'Seven strands' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Quick start' })).toBeNull();
  });

  it('has a level picker that remembers the level and then offers where to start', async () => {
    const { container } = render(HomePage());
    const levels = screen.getByRole('region', { name: 'Which level are you?' });
    const button = within(levels).getByRole('button', { name: /Level 5-6/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(within(levels).queryByRole('button', { name: /quick problems/ })).toBeNull();
    await userEvent.click(button);
    expect(window.localStorage.getItem('ka-level')).toBe('5-6');
    expect(within(levels).getByRole('button', { name: /Level 5-6/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(levels).getByRole('button', { name: /quick problems/ })).toBeInTheDocument();
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/practice/diagnostic');
    expect(hrefs).toContain('/problems?level=5-6');
    expect(container.textContent).not.toMatch(/sign in/i);
  });

  it('shows every level with its problem count, counted from the bank', () => {
    render(HomePage());
    const levels = screen.getByRole('region', { name: 'Which level are you?' });
    for (const band of BANDS) {
      const total = getAllProblems().filter((p) => p.band === band).length;
      expect(
        within(levels).getByRole('button', { name: new RegExp(`Level ${band}\\b`) }),
      ).toHaveTextContent(`${total} problems`);
    }
  });

  it('shows a problem of the day that links to the problem', () => {
    render(HomePage());
    const card = screen.getByRole('region', { name: 'Problem of the day' });
    expect(card.querySelector('a[href^="/problem/KA-"]')).not.toBeNull();
  });

  it('counts only what it can count, from the content files', () => {
    const { container } = render(HomePage());
    expect(container.textContent).toContain(stats.skills.toLocaleString('en-US'));
    expect(container.textContent).toContain(stats.problems.toLocaleString('en-US'));
    expect(container.textContent).toContain(stats.misconceptions.toLocaleString('en-US'));
  });

  it('does not invent a students-served figure', () => {
    const { container } = render(HomePage());
    expect(container.textContent).not.toMatch(/students (served|helped)/i);
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
    expect(screen.getByRole('region', { name: 'Quick start' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Seven strands' })).getAllByRole('progressbar'),
    ).toHaveLength(7);
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
