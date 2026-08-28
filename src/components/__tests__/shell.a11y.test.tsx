import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import { Footer } from '../Footer';
import { Header } from '../Header';
import { MobileTabBar } from '../MobileTabBar';
import { SkipLink } from '../SkipLink';
import NotFound from '@/app/not-found';
import Loading from '@/app/loading';

vi.mock('next/navigation', () => ({ usePathname: () => '/atlas' }));

/**
 * M1.1's acceptance: axe reports zero violations on the empty shell, in both themes.
 *
 * The shell is assembled here rather than rendering RootLayout, because RootLayout emits
 * <html> and <body> and jsdom already has those. The landmark structure is identical.
 */
function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}

describe('the app shell', () => {
  it('has no axe violations in either theme', async () => {
    const { container } = render(<Shell />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with the 404 page inside it', async () => {
    const { container } = render(
      <Shell>
        <NotFound />
      </Shell>,
    );
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations with the loading state inside it', async () => {
    const { container } = render(
      <Shell>
        <Loading />
      </Shell>,
    );
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('exposes exactly one main landmark and one contentinfo landmark', () => {
    const { container } = render(<Shell />);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelectorAll('footer')).toHaveLength(1);
    expect(container.querySelectorAll('header')).toHaveLength(1);
  });

  it('gives every navigation landmark its own accessible name', () => {
    const { container } = render(<Shell />);
    const navs = [...container.querySelectorAll('nav')];
    expect(navs.length).toBeGreaterThan(1);
    const names = navs.map((nav) => nav.getAttribute('aria-label'));
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});
