import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Footer } from '../Footer';
import { NavLinks } from '../NavLinks';
import { MobileTabBar } from '../MobileTabBar';
import { SkipLink } from '../SkipLink';
import { ThemeToggle, THEME_STORAGE_KEY, THEME_INIT_SCRIPT } from '../ThemeToggle';
import { AmcDisclaimer } from '../AmcDisclaimer';
import { Header } from '../Header';
import {
  AMC_DISCLAIMER,
  DISCLAIMER,
  MOBILE_NAV,
  PRIMARY_NAV,
  isActivePath,
  isNavItemActive,
} from '@/lib/site';

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

beforeEach(() => {
  pathname.current = '/';
  window.localStorage.clear();
});

describe('SkipLink', () => {
  it('is the first focusable thing and points at the main landmark', async () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: /skip to main content/i });
    expect(link).toHaveAttribute('href', '#main');
    await userEvent.tab();
    expect(link).toHaveFocus();
  });
});

describe('link hover', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');

  it('thickens the underline rather than dropping the colour contrast', () => {
    // Hovering to --accent-600 took a link from 11:1 to 3.9:1 in a dark well. A hover state
    // must not make text harder to read than it was at rest.
    expect(css).toMatch(/a:hover\s*\{[^}]*text-decoration-thickness/);
    expect(css).not.toMatch(/a:hover\s*\{[^}]*color:/);
  });
});

describe('Footer', () => {
  it('carries the non-affiliation disclaimer verbatim', () => {
    render(<Footer />);
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it('links to the licence, privacy and the repository', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/legal/privacy');
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      expect.stringContaining('github.com'),
    );
    expect(screen.getAllByRole('link', { name: /MIT|CC BY-NC-SA/ }).length).toBeGreaterThan(0);
  });
});

describe('NavLinks', () => {
  it('marks the current section with aria-current and a heavier weight, not colour alone', () => {
    pathname.current = '/atlas';
    render(<NavLinks items={PRIMARY_NAV} />);
    const atlas = screen.getByRole('link', { name: 'Skill Atlas' });
    expect(atlas).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Past papers' })).not.toHaveAttribute('aria-current');
    expect(atlas.className).toContain('font-semibold');
  });

  it('treats a nested route as inside its section', () => {
    pathname.current = '/atlas/CNT';
    render(<NavLinks items={PRIMARY_NAV} />);
    expect(screen.getByRole('link', { name: 'Skill Atlas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders the destinations in order, papers and exams folding into Exams below lg', () => {
    render(<NavLinks items={PRIMARY_NAV} />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/problems',
      '/atlas',
      '/papers',
      '/exams',
      '/amc',
      '/sat',
      '/act',
      '/progress',
    ]);
    expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Question bank' })).toHaveAttribute(
      'href',
      '/problems',
    );
    // Only one of the two forms is on screen at a time, and the other is display:none, so a
    // screen reader meets one or the other, never both.
    const item = (name: string) => screen.getByRole('link', { name }).closest('li');
    expect(item('Exams')?.className).toBe('lg:hidden');
    for (const name of ['Past papers', 'AMC (Beta)', 'SAT', 'ACT']) {
      expect(item(name)?.className).toBe('hidden lg:block');
    }
    expect(item('Progress')?.className ?? '').toBe('');
  });

  it('highlights Exams inside every exam area', () => {
    for (const path of ['/exams', '/amc/problems', '/sat', '/act/problem/AC-0001', '/papers']) {
      pathname.current = path;
      const { unmount } = render(<NavLinks items={PRIMARY_NAV} />);
      expect(screen.getByRole('link', { name: 'Exams' }), path).toHaveAttribute(
        'aria-current',
        'page',
      );
      unmount();
    }
    pathname.current = '/sat/problems';
    render(<NavLinks items={PRIMARY_NAV} />);
    expect(screen.getByRole('link', { name: 'SAT' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'ACT' })).not.toHaveAttribute('aria-current');
  });

  it('carries a visible Beta pill on AMC, and says so to a screen reader', () => {
    render(<NavLinks items={PRIMARY_NAV} />);
    const amc = screen.getByRole('link', { name: 'AMC (Beta)' });
    expect(amc).toHaveAttribute('href', '/amc');
    expect(amc).toHaveTextContent('Beta');
  });

  it('highlights Practice on the practice sessions and the bank on a single problem', () => {
    pathname.current = '/practice/diagnostic';
    const { unmount } = render(<NavLinks items={PRIMARY_NAV} />);
    expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute('aria-current', 'page');
    unmount();
    pathname.current = '/problem/KA-0001';
    render(<NavLinks items={PRIMARY_NAV} />);
    expect(screen.getByRole('link', { name: 'Question bank' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Practice' })).not.toHaveAttribute('aria-current');
  });
});

describe('Header', () => {
  it('is a sticky surface bar with the wordmark, the primary nav and the theme toggle', () => {
    render(<Header />);
    const banner = screen.getByRole('banner');
    expect(banner.className).toContain('sticky');
    expect(banner.className).toContain('bg-surface');
    expect(screen.getByRole('link', { name: /Kangaroo Atlas home/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /colour theme/i })).toBeInTheDocument();
  });

  it('takes its height from the header-height token the skill rail sticks beneath', () => {
    const { container } = render(<Header />);
    expect(container.querySelector('.h-\\[var\\(--header-height\\)\\]')).not.toBeNull();
  });
});

describe('isNavItemActive', () => {
  const [practice, bank, atlas] = PRIMARY_NAV;
  it.each([
    ['/', practice, true],
    ['/practice/mock', practice, true],
    ['/problems', practice, false],
    ['/problem/KA-0002', bank, true],
    ['/skill/CNT-12', atlas, true],
    ['/skills', atlas, false],
  ])('isNavItemActive(%s, %o)', (path, item, expected) => {
    expect(item).toBeDefined();
    if (item) expect(isNavItemActive(path, item)).toBe(expected);
  });
});

describe('AmcDisclaimer', () => {
  it('states the MAA trademark notice verbatim', () => {
    render(<AmcDisclaimer />);
    expect(screen.getByRole('note')).toHaveTextContent(AMC_DISCLAIMER);
    expect(AMC_DISCLAIMER).toContain('Mathematical Association of America');
    expect(AMC_DISCLAIMER).toContain('Not affiliated with or endorsed by the MAA.');
  });
});

describe('isActivePath', () => {
  it.each([
    ['/', '/', true],
    ['/atlas', '/', false],
    ['/atlas', '/atlas', true],
    ['/atlas/CNT', '/atlas', true],
    ['/atlas-extra', '/atlas', false],
    ['/problems', '/atlas', false],
  ])('isActivePath(%s, %s) === %s', (path, href, expected) => {
    expect(isActivePath(path, href)).toBe(expected);
  });
});

describe('MobileTabBar', () => {
  it('is a labelled navigation landmark', () => {
    render(<MobileTabBar />);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('keeps five tabs, with every exam behind one Exams tab (docs/07 section 4)', () => {
    render(<MobileTabBar />);
    expect(MOBILE_NAV).toHaveLength(5);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/problems',
      '/atlas',
      '/exams',
      '/progress',
    ]);
  });

  it('marks Exams as the active tab inside an exam area', () => {
    pathname.current = '/act/problems';
    render(<MobileTabBar />);
    expect(screen.getByRole('link', { name: 'Exams' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the active tab', () => {
    pathname.current = '/problems';
    render(<MobileTabBar />);
    expect(screen.getByRole('link', { name: 'Question bank' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('ThemeToggle', () => {
  it('is a labelled radio group with three choices', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('radiogroup', { name: /colour theme/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('defaults to LIGHT, not to the machine\u2019s dark mode', () => {
    // The problem statements, the figures and every printed worksheet were designed against
    // paper white, so a reader who has never touched the toggle gets light even on a
    // dark-mode machine. "System" remains one click away.
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('still honours an explicit system choice by removing the attribute', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('applies and persists an explicit dark choice', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });

  it('applies and persists an explicit light choice, overriding a dark system', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('returns to the system theme by removing the attribute', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    await userEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('restores a stored choice on mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });

  it('is fully operable from the keyboard', async () => {
    render(<ThemeToggle />);
    const [light] = screen.getAllByRole('radio');
    light?.focus();
    expect(light).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('survives localStorage throwing, as it does in some private modes', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('the no-flash init script', () => {
  it('reads the same storage key the toggle writes', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
  });

  it('stamps light when nothing is stored, rather than deferring to the media query', () => {
    // Leaving the attribute off would hand the decision to prefers-color-scheme, which is
    // exactly what opened the site in dark on a dark-mode machine despite light being the
    // default the design is built around.
    expect(THEME_INIT_SCRIPT).toContain("'light'");
    expect(THEME_INIT_SCRIPT).toContain("t==='dark'?'dark':'light'");
  });

  it('lets an explicit "system" choice fall through to the media query', () => {
    expect(THEME_INIT_SCRIPT).toContain("t==='system'");
    expect(THEME_INIT_SCRIPT).toContain('removeAttribute');
  });

  it('is wrapped so a browser with storage disabled still paints', () => {
    expect(THEME_INIT_SCRIPT).toContain('try{');
    expect(THEME_INIT_SCRIPT).toContain('catch');
  });
});

describe('the skip link stylesheet', () => {
  // Regression guard. The first version composed `.visually-hidden` with Tailwind `focus:`
  // utilities. Utilities live in Tailwind's cascade layer and globals.css does not, so the
  // unlayered `.visually-hidden` beat every focus utility and the link stayed 1px square while
  // focused - invisible, and therefore useless. Longhand CSS avoids the trap; this asserts it.
  const css = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8');

  it('hides the link by default', () => {
    const base = extractRule(css, '.skip-link');
    expect(base).toContain('clip-path: inset(50%)');
    expect(base).toContain('width: 1px');
  });

  it('reveals it on focus, undoing every hiding declaration', () => {
    const focused = extractRule(css, '.skip-link:focus');
    for (const declaration of [
      'width: auto',
      'height: auto',
      'clip-path: none',
      'overflow: visible',
    ]) {
      expect(focused, `.skip-link:focus must set ${declaration}`).toContain(declaration);
    }
    expect(focused).toContain('background: var(--surface)');
  });
});

function extractRule(css: string, selector: string): string {
  const pattern = new RegExp(
    `(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
    'm',
  );
  return pattern.exec(css)?.[2] ?? '';
}
