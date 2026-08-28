'use client';

import { useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'ka-theme';

const OPTIONS: Array<{ value: ThemeChoice; label: string; glyph: string }> = [
  { value: 'light', label: 'Light', glyph: '☀' },
  { value: 'system', label: 'System', glyph: '◐' },
  { value: 'dark', label: 'Dark', glyph: '☾' },
];

/**
 * Applies a theme choice to the document.
 *
 * "system" removes the attribute entirely rather than writing data-theme="system", so the
 * prefers-color-scheme media query in tokens.css takes over. This is the same logic the
 * blocking script in <head> runs before first paint; keep the two in step.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

function readStoredTheme(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private browsing, or storage disabled. The system theme is a perfectly good default.
  }
  return 'system';
}

export function ThemeToggle() {
  // Render "system" on the server and on the first client pass so the markup matches; the
  // effect below corrects it immediately. The paint itself is already right, because the
  // blocking script set data-theme before React ever ran.
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChoice(readStoredTheme());
    setReady(true);
  }, []);

  function select(next: ThemeChoice) {
    setChoice(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is not a reason to refuse to make it.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-sm border border-rule p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = ready && choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={`${option.label} theme`}
            onClick={() => select(option.value)}
            className={[
              'cursor-pointer rounded-xs px-2 py-1 text-xs leading-none transition-colors',
              selected ? 'bg-accent-soft text-ink' : 'text-ink-3 hover:text-ink',
            ].join(' ')}
          >
            <span aria-hidden="true">{option.glyph}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The blocking script that runs before first paint.
 *
 * Without this the page renders in the light theme and then snaps to dark, which is worse than
 * no theme toggle at all. It is deliberately tiny, dependency-free, and wrapped in try/catch so
 * a browser with storage disabled still paints.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;
