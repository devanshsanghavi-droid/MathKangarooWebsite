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
import { DISCLAIMER, PRIMARY_NAV, isActivePath } from '@/lib/site';

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
  it('marks the current section with aria-current, not colour alone', () => {
    pathname.current = '/atlas';
    render(<NavLinks items={PRIMARY_NAV} />);
    const atlas = screen.getByRole('link', { name: 'Atlas' });
    expect(atlas).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Papers' })).not.toHaveAttribute('aria-current');
    expect(atlas.className).toContain('underline');
  });

  it('treats a nested route as inside its section', () => {
    pathname.current = '/atlas/CNT';
    render(<NavLinks items={PRIMARY_NAV} />);
    expect(screen.getByRole('link', { name: 'Atlas' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders every primary destination', () => {
    render(<NavLinks items={PRIMARY_NAV} />);
    for (const item of PRIMARY_NAV) {
      expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href);
    }
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

  it('marks the active tab', () => {
    pathname.current = '/problems';
    render(<MobileTabBar />);
    expect(screen.getByRole('link', { name: 'Problems' })).toHaveAttribute('aria-current', 'page');
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
