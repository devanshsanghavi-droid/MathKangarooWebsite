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
import { liveExams, soonExams } from '@/lib/exams';

const stats = getContentStats();

describe('/ - the home page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetProgressCache();
    resetLevelMemory();
  });

  it('opens a first visit with the every-exam headline and its two buttons', () => {
    render(HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Practice for every math exam in one place.',
    );
    expect(screen.getByRole('link', { name: 'Start practicing' })).toHaveAttribute(
      'href',
      '#start',
    );
    expect(screen.getAllByRole('link', { name: 'Explore a demo student' })[0]).toHaveAttribute(
      'href',
      '/progress?demo=1',
    );
    // The button's target exists on the page.
    expect(document.getElementById('start')).not.toBeNull();
  });

  it('has a shortcut chip for every live exam and quieter chips for the soon ones', () => {
    render(HomePage());
    const chips = screen.getByRole('navigation', { name: 'Exam shortcuts' });
    for (const exam of liveExams()) {
      const link = within(chips).getByRole('link', { name: exam.shortName });
      expect(link).toHaveAttribute('href', exam.routes.page);
      expect(link.className).toContain(exam.classes.fill.split(' ')[0]);
    }
    for (const exam of soonExams()) {
      expect(
        within(chips).getByRole('link', { name: new RegExp(`${exam.shortName}.*soon`) }),
      ).toHaveAttribute('href', exam.routes.page);
    }
  });

  it('shows a compact card per live exam in the exam chooser', () => {
    render(HomePage());
    const start = screen.getByRole('region', { name: 'Choose your exam' });
    for (const exam of liveExams()) {
      expect(
        within(start).getByRole('link', { name: new RegExp(`^${exam.name}`) }),
      ).toHaveAttribute('href', exam.routes.page);
    }
  });

  it('explains how it works in four steps: learn, practice, test, track', () => {
    render(HomePage());
    const how = screen.getByRole('region', { name: 'Learn, practice, test, track' });
    expect(
      within(how)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent?.replace(/^Step \d: /, '')),
    ).toEqual(['Learn', 'Practice', 'Test', 'Track']);
  });

  it('has a grade map, a labelled example chart and the more-subjects strip', () => {
    render(HomePage());
    expect(screen.getByRole('region', { name: 'Which exams fit your grade?' })).toBeInTheDocument();
    const preview = screen.getByRole('region', { name: 'See your progress at a glance' });
    expect(within(preview).getByText('Example data')).toBeInTheDocument();
    expect(within(preview).getByRole('img', { name: /Example chart, not real data/ })).toBeTruthy();
    expect(within(preview).getByRole('link', { name: 'Explore a demo student' })).toHaveAttribute(
      'href',
      '/progress?demo=1',
    );
    expect(
      screen.getByRole('region', { name: /More subjects coming: science, reading and writing/ }),
    ).toBeInTheDocument();
  });

  it('does not show the progress dashboard to a first-time visitor', () => {
    render(HomePage());
    expect(screen.queryByRole('region', { name: 'Seven strands' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Quick start' })).toBeNull();
  });

  it('keeps the Kangaroo level step: it remembers the level and then offers where to start', async () => {
    const { container } = render(HomePage());
    const levels = screen.getByRole('region', { name: 'Math Kangaroo: which level are you?' });
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
    const levels = screen.getByRole('region', { name: 'Math Kangaroo: which level are you?' });
    for (const band of BANDS) {
      const total = getAllProblems().filter((p) => p.band === band).length;
      expect(
        within(levels).getByRole('button', { name: new RegExp(`Level ${band}\\b`) }),
      ).toHaveTextContent(`${total} problems`);
    }
  });

  it('shows a puzzle of the day that can be answered on the page and links to the problem', () => {
    render(HomePage());
    const card = screen.getByRole('region', { name: 'Puzzle of the day' });
    expect(within(card).getAllByRole('button', { name: /^[A-E]/ })).toHaveLength(5);
    expect(card.querySelector('a[href^="/problem/KA-"]')).not.toBeNull();
  });

  it('keeps the welcome view after the puzzle of the day is answered', async () => {
    render(HomePage());
    const card = screen.getByRole('region', { name: 'Puzzle of the day' });
    const [first] = within(card).getAllByRole('button', { name: /^[A-E]/ });
    if (!first) throw new Error('no choices');
    await userEvent.click(first);
    expect(window.localStorage.getItem('ka-progress')).toContain('"problemId"');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Practice for every math exam in one place.',
    );
    expect(screen.getByTestId('feedback')).toBeInTheDocument();
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

  it('greets a returning student with a Continue card, their own counts and exam chips', () => {
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
    const chips = screen.getByRole('navigation', { name: 'Your exams' });
    expect(within(chips).getAllByRole('link')).toHaveLength(liveExams().length);
    expect(screen.getByRole('region', { name: 'Puzzle of the day' })).toBeInTheDocument();
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
