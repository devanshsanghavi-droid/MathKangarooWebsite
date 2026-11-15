import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import PrintPage, * as route from '../print/page';
import { getAllProblems } from '@/lib/content';
import {
  DEFAULT_WORKSHEET,
  matchesWorksheet,
  parseWorksheetQuery,
  selectProblems,
} from '@/lib/worksheet';
import { BANDS, STRANDS } from '@/lib/schemas';
import { installStaticDataFetch } from '../../../test/static-data';

function sheetIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.answer-key li.worksheet-item .mono.text-2xs')].map(
    (node) => node.textContent ?? '',
  );
}

async function renderPrint(path = '/print') {
  window.history.replaceState(null, '', path);
  const fetchMock = installStaticDataFetch();
  const utils = render(PrintPage());
  // The builder has applied the URL once the index and the chosen problems have been fetched.
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/data/p/'))).toBe(true),
  );
  await waitFor(() => expect(utils.container.querySelector('[aria-busy]')).toBeNull());
  return utils;
}

/**
 * A filter combination the bank has no problem for. Worked out from the content rather than
 * hard-coded, because the bank keeps growing and a fixed combination stops being empty.
 */
function emptyWorksheetPath(): string {
  const problems = getAllProblems();
  for (const band of BANDS) {
    for (const strand of STRANDS) {
      for (const points of [3, 4, 5]) {
        const search = `band=${band}&strand=${strand}&points=${points}&figures=0`;
        const query = parseWorksheetQuery(Object.fromEntries(new URLSearchParams(search)));
        if (!problems.some((problem) => matchesWorksheet(problem, query))) {
          return `/print?${search}`;
        }
      }
    }
  }
  throw new Error('every filter combination has a problem: pick another empty-state query');
}

beforeEach(() => window.localStorage.clear());

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the worksheet generator', () => {
  it('is static, and bakes the default sheet into the HTML', () => {
    expect(route.dynamic).toBe('force-static');
    installStaticDataFetch().mockImplementation(() => new Promise<Response>(() => {}));
    const { container } = render(PrintPage());
    const expected = selectProblems(getAllProblems(), DEFAULT_WORKSHEET).selected.map((p) => p.id);
    expect(sheetIds(container)).toEqual(expected);
  });

  it('renders a numbered worksheet and a separate answer key from the URL', async () => {
    const { container } = await renderPrint('/print?count=5&seed=3');
    const sheet = container.querySelector('.worksheet');
    const key = container.querySelector('.answer-key');
    expect(sheet?.querySelectorAll('li.worksheet-item')).toHaveLength(5);
    expect(key?.querySelectorAll('li.worksheet-item')).toHaveLength(5);
  });

  it('picks the same problems from the static index as from the full bank', async () => {
    const { container } = await renderPrint('/print?count=8&seed=77&band=5-6');
    const expected = selectProblems(getAllProblems(), {
      ...DEFAULT_WORKSHEET,
      count: 8,
      seed: 77,
      bands: ['5-6'],
    }).selected.map((p) => p.id);
    expect(sheetIds(container)).toEqual(expected);
  });

  it('never prints an answer on the worksheet itself', async () => {
    const { container } = await renderPrint('/print?count=6&seed=9');
    expect(container.querySelector('.worksheet')?.textContent).not.toMatch(/correct|answer key/i);
  });

  it('gives the tutor the misconception behind every wrong choice', async () => {
    const { container } = await renderPrint('/print?count=4&seed=2');
    const notes = container.querySelector('.answer-key')?.querySelectorAll('li ul li') ?? [];
    expect(notes).toHaveLength(16);
    for (const note of notes) {
      expect(note.textContent?.trim().length ?? 0).toBeGreaterThan(30);
      expect(note.textContent).toMatch(/I\s/);
    }
  });

  it('applies a control in the browser and mirrors it into the URL', async () => {
    const user = userEvent.setup();
    const { container } = await renderPrint('/print');
    await user.click(screen.getByRole('button', { name: '5', pressed: false }));
    await waitFor(() =>
      expect(container.querySelectorAll('.worksheet li.worksheet-item')).toHaveLength(5),
    );
    expect(window.location.search).toBe('?count=5');
    // Controls are buttons, not links: the generator has no crawlable filter URLs.
    expect(
      within(container.querySelector('.no-print') as HTMLElement).queryAllByRole('link'),
    ).toHaveLength(0);
  });

  it('reshuffles to the next seed', async () => {
    const user = userEvent.setup();
    await renderPrint('/print?count=5');
    await user.click(screen.getByRole('button', { name: 'Reshuffle' }));
    expect(window.location.search).toBe('?count=5&seed=2');
  });

  it('leaves the controls off the printed page and keeps the disclaimer on the sheet', async () => {
    const { container } = await renderPrint('/print?count=3');
    expect(container.querySelector('.no-print')).not.toBeNull();
    expect(container.querySelector('.worksheet')?.textContent).toMatch(
      /not affiliated with Math Kangaroo/i,
    );
    expect(screen.getByText(/Name:/)).toBeInTheDocument();
    expect(
      within(container.querySelector('.worksheet header') as HTMLElement).getByText(
        /questions · \d+ points/,
      ),
    ).toBeInTheDocument();
  });

  it('shows a written empty state when nothing matches', async () => {
    window.history.replaceState(null, '', emptyWorksheetPath());
    installStaticDataFetch();
    const { container } = render(PrintPage());
    expect(await screen.findByText(/No problem matches these filters/)).toBeInTheDocument();
    expect(container.querySelector('.worksheet')).toBeNull();
  });

  it('has no axe violations in either theme', async () => {
    const { container } = await renderPrint('/print?count=6');
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations in the empty state', async () => {
    window.history.replaceState(null, '', emptyWorksheetPath());
    installStaticDataFetch();
    const { container } = render(PrintPage());
    await screen.findByText(/No problem matches these filters/);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
