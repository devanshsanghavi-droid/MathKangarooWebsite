import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import PrintPage from '../print/page';
import type { RawSearchParams } from '@/lib/worksheet';

async function renderPrint(searchParams: RawSearchParams = {}) {
  return render(await PrintPage({ searchParams: Promise.resolve(searchParams) }));
}

describe('the worksheet generator', () => {
  it('renders a numbered worksheet and a separate answer key', async () => {
    const { container } = await renderPrint({ count: '5', seed: '3' });
    const sheet = container.querySelector('.worksheet');
    const key = container.querySelector('.answer-key');
    expect(sheet).not.toBeNull();
    expect(key).not.toBeNull();
    expect(sheet?.querySelectorAll('li.worksheet-item')).toHaveLength(5);
    expect(key?.querySelectorAll('li.worksheet-item')).toHaveLength(5);
  });

  it('never prints an answer on the worksheet itself', async () => {
    const { container } = await renderPrint({ count: '6', seed: '9' });
    const sheet = container.querySelector('.worksheet');
    expect(sheet?.textContent).not.toMatch(/correct|answer key/i);
  });

  it('gives the tutor the misconception behind every wrong choice', async () => {
    const { container } = await renderPrint({ count: '4', seed: '2' });
    const key = container.querySelector('.answer-key');
    // Four distractors per problem, four problems.
    const notes = key?.querySelectorAll('li ul li') ?? [];
    expect(notes).toHaveLength(16);
    for (const note of notes) {
      expect(note.textContent?.trim().length ?? 0).toBeGreaterThan(30);
      // Written in the student's own voice. textContent concatenates the choice letter onto
      // the note with no space ("AI counted..."), so there is no word boundary to anchor on.
      expect(note.textContent).toMatch(/I\s/);
    }
  });

  it('leaves the controls off the printed page', async () => {
    const { container } = await renderPrint({});
    const controls = container.querySelector('.no-print');
    expect(controls).not.toBeNull();
  });

  it('carries the non-affiliation line onto the sheet itself', async () => {
    const { container } = await renderPrint({ count: '3' });
    expect(container.querySelector('.worksheet')?.textContent).toMatch(
      /not affiliated with Math Kangaroo/i,
    );
  });

  it('shows a written empty state when nothing matches', async () => {
    // Every band now holds problems, so an empty result has to be asked for rather than
    // found: a level filtered down to a strand that level never covers matches nothing.
    const { container } = await renderPrint({ band: '1-2', strand: 'MOD', points: '5' });
    expect(container.textContent).toMatch(/No problem matches these filters/);
    expect(container.querySelector('.worksheet')).toBeNull();
  });

  it('offers a name and date line for the student', async () => {
    await renderPrint({ count: '3' });
    expect(screen.getByText(/Name:/)).toBeInTheDocument();
  });

  it('totals the points on the sheet', async () => {
    const { container } = await renderPrint({ count: '5', seed: '4' });
    const header = container.querySelector('.worksheet header');
    expect(within(header as HTMLElement).getByText(/questions · \d+ points/)).toBeInTheDocument();
  });

  it('has no axe violations in either theme', async () => {
    const { container } = await renderPrint({ count: '6' });
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('has no axe violations in the empty state', async () => {
    const { container } = await renderPrint({ band: '11-12' });
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
