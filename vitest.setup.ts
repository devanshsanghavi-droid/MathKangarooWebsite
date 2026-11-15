import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

// jsdom implements neither of these, and the theme toggle and reduced-motion rules read them.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

if (!window.scrollTo) {
  Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
}

// jsdom gives MathML elements no `style`, so getComputedStyle throws on the MathML half of
// KaTeX's output (AMC statements, <MathText>), and Testing Library calls it while computing
// accessible names. Fall back to an empty element's computed style for those elements only.
{
  const getComputedStyle = window.getComputedStyle.bind(window);
  const fallback = document.createElement('span');
  window.getComputedStyle = (element: Element, pseudo?: string | null) => {
    try {
      return getComputedStyle(element, pseudo);
    } catch (error) {
      if (element.namespaceURI === 'http://www.w3.org/1998/Math/MathML') {
        return getComputedStyle(fallback);
      }
      throw error;
    }
  };
}
