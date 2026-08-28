/**
 * axe-core helpers for `pnpm a11y`.
 *
 * Honest scope: this runs in jsdom, which has no layout engine. Rules that need geometry -
 * colour contrast against a computed background, target size, overlap - report as
 * "incomplete" rather than pass or fail, and are excluded here so they cannot masquerade as
 * coverage. Contrast is instead proven directly against the tokens in
 * src/lib/__tests__/tokens.test.ts, which does not need a browser.
 *
 * What this DOES catch, and catches reliably: missing accessible names, wrong or missing
 * roles, unlabelled form controls, broken heading order, duplicate landmarks, invalid ARIA,
 * and list/table structure errors. Those are the majority of real violations.
 */

import axe, { type AxeResults, type RunOptions, type Result } from 'axe-core';

/** Rules that cannot be evaluated without layout, and would otherwise report as incomplete. */
const LAYOUT_DEPENDENT_RULES = ['color-contrast', 'target-size', 'scrollable-region-focusable'];

export type Theme = 'light' | 'dark';

export interface A11yViolation {
  id: string;
  impact: string;
  help: string;
  nodes: string[];
}

function summarise(results: AxeResults): A11yViolation[] {
  return results.violations.map((violation: Result) => ({
    id: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    nodes: violation.nodes.map((node) => node.html),
  }));
}

/**
 * Run axe over `element` in one theme. Setting data-theme on <html> is exactly what the theme
 * toggle does, so this exercises the same code path a reader would.
 */
export async function auditTheme(element: Element, theme: Theme): Promise<A11yViolation[]> {
  const root = document.documentElement;
  const previous = root.getAttribute('data-theme');
  root.setAttribute('data-theme', theme);
  try {
    const options: RunOptions = {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
      rules: Object.fromEntries(LAYOUT_DEPENDENT_RULES.map((id) => [id, { enabled: false }])),
      resultTypes: ['violations'],
    };
    return summarise(await axe.run(element, options));
  } finally {
    if (previous === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', previous);
  }
}

/** Run axe in both themes and return every violation found, tagged with the theme. */
export async function auditBothThemes(element: Element): Promise<string[]> {
  const found: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    for (const violation of await auditTheme(element, theme)) {
      found.push(
        `[${theme}] ${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes[0] ?? ''}`,
      );
    }
  }
  return found;
}
