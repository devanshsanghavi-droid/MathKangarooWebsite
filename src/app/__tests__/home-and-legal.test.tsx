import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../page';
import AboutPage from '../about/page';
import PrivacyPage from '../legal/privacy/page';
import TermsPage from '../legal/terms/page';
import LicensePage from '../legal/license/page';
import { getContentStats, getStrandSummaries } from '@/lib/content';
import { DISCLAIMER } from '@/lib/site';

const stats = getContentStats();

describe('/ — the home page', () => {
  it('leads with the thesis, not with a feature list', () => {
    render(HomePage());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Math Kangaroo preparation organised by skill, not by year.',
    );
  });

  it('embeds a live sample problem above the fold', () => {
    const { container } = render(HomePage());
    const choices = within(container).getByRole('group', { name: /answer choices/i });
    expect(within(choices).getAllByRole('button')).toHaveLength(5);
  });

  it('shows distractor-specific feedback right there on the home page', async () => {
    render(HomePage());
    const choices = screen.getByRole('group', { name: /answer choices/i });
    const wrong = within(choices)
      .getAllByRole('button')
      .find((button) => /^E/.test(button.textContent ?? ''));
    if (!wrong) throw new Error('the sample problem has no choices');
    await userEvent.click(wrong);
    const feedback = screen.getByTestId('feedback');
    expect(feedback).toHaveAttribute('data-outcome', 'incorrect');
    expect(feedback.textContent).toMatch(/I counted the nine small squares/);
  });

  it('offers the start-here triad', () => {
    const { container } = render(HomePage());
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/atlas');
    expect(hrefs).toContain('/problems');
    expect(hrefs).toContain('/papers');
  });

  it('shows all seven strands with live counts', () => {
    const { container } = render(HomePage());
    for (const strand of getStrandSummaries()) {
      expect(container.textContent, strand.strand).toContain(strand.name);
      expect(container.textContent, strand.strand).toContain(`${strand.skillCount} skills`);
    }
  });

  it('shows a problem of the day that links to the problem', () => {
    const { container } = render(HomePage());
    const section = [...container.querySelectorAll('section')].find((node) =>
      /Problem of the day/i.test(node.textContent ?? ''),
    );
    expect(section).toBeDefined();
    expect(section?.querySelector('a[href^="/problem/"]')).not.toBeNull();
  });

  it('counts only what it can count, and defines every counter', () => {
    const { container } = render(HomePage());
    expect(container.textContent).toContain(String(stats.skills));
    expect(container.textContent).toContain(String(stats.problems));
    expect(container.textContent).toContain(String(stats.misconceptions));
    // Each tile carries a definition sentence, the same discipline /impact will need.
    expect(container.textContent).toMatch(/One per wrong answer choice/);
  });

  it('does not invent a students-served figure', () => {
    const { container } = render(HomePage());
    expect(container.textContent).toMatch(/fewer than\s+ten students is published at all/);
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
