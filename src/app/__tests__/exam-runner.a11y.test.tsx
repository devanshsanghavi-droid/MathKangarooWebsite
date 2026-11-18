import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import AmcMockPage from '../amc/mock/page';
import AmcSectionPage from '../amc/section/page';
import SatMockPage from '../sat/mock/page';
import SatSectionPage from '../sat/section/page';
import ActMockPage from '../act/mock/page';
import ActSectionPage from '../act/section/page';
import PracticeSectionPage from '../practice/section/page';
import { installExamData } from '../../../test/exam-fixtures';

vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

beforeEach(() => {
  window.localStorage.clear();
  installExamData();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the exam start screens', () => {
  it.each([
    ['/amc/mock', AmcMockPage, /Start AMC 10/],
    ['/sat/mock', SatMockPage, /Start the SAT Math mock/],
    ['/amc/section', AmcSectionPage, /Start the section test/],
    ['/sat/section', SatSectionPage, /Start the section test/],
    ['/practice/section', PracticeSectionPage, /Start the section test/],
  ] as const)('%s has no axe violations in either theme', async (_path, Page, ready) => {
    const { container } = render(<Page />);
    await screen.findByRole('button', { name: ready });
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it.each([
    ['/act/mock', ActMockPage],
    ['/act/section', ActSectionPage],
  ] as const)('%s renders its prerendered half without violations', async (_path, Page) => {
    // No ACT fixture is served here, so the start screen shows the load failure: that state
    // must be accessible too.
    const { container } = render(<Page />);
    await screen.findByRole('alert');
    expect(await auditBothThemes(container)).toEqual([]);
  });
});

describe('sitting and reviewing', () => {
  async function start() {
    const user = userEvent.setup();
    const view = render(<SatMockPage />);
    await user.click(await screen.findByRole('button', { name: /Start the SAT Math mock/ }));
    await screen.findByRole('timer');
    return { user, ...view };
  }

  it('the runner has no axe violations, with a pick, a flag and the confirmation open', async () => {
    const { user, container } = await start();
    const group = screen.getByRole('group', { name: /answer choices/i });
    const first = group.querySelector('button');
    if (first) await user.click(first);
    await user.click(screen.getByRole('button', { name: 'Flag for review' }));
    await user.click(screen.getByRole('button', { name: 'Submit module 1' }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('the report has no axe violations', async () => {
    const { user, container } = await start();
    const group = screen.getByRole('group', { name: /answer choices/i });
    const buttons = group.querySelectorAll('button');
    if (buttons[2]) await user.click(buttons[2]);
    await user.click(screen.getByRole('button', { name: 'Submit module 1' }));
    await user.click(screen.getByRole('button', { name: 'Submit and start module 2' }));
    await user.click(screen.getByRole('button', { name: 'Submit test' }));
    await user.click(screen.getByRole('button', { name: 'Submit and see my score' }));
    await screen.findByRole('heading', { name: /Your result/ });
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('the AMC runner, with KaTeX, has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = render(<AmcMockPage />);
    await user.click(await screen.findByRole('button', { name: /Start AMC 10/ }));
    await screen.findByRole('timer');
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
