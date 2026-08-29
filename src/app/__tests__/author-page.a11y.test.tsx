import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { auditBothThemes } from '@/lib/a11y';
import { AuthorForm } from '../author/new/AuthorForm';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { FIGURE_NAMES } from '@/components/figures/registry';

const props = {
  knownSkillIds: getAllSkills().map((s) => s.id),
  usedProblemIds: getAllProblems().map((p) => p.id),
  nextId: 'KA-9001',
  today: '2026-08-28',
  repo: 'https://github.com/owner/repo',
  figureNames: FIGURE_NAMES,
};

describe('the authoring form', () => {
  it('labels every field', () => {
    render(<AuthorForm {...props} />);
    for (const name of [/^Id$/, /Statement/, /Primary skill/, /Nudge/, /The reliable way/]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it('shows what is still wrong, live, before anything is typed', () => {
    render(<AuthorForm {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent(/still to fix/);
  });

  it('asks for a misconception on every choice except the correct one', () => {
    render(<AuthorForm {...props} />);
    // A is correct by default, so four misconception boxes and one explanatory note.
    expect(screen.getAllByLabelText(/Misconception for choice/)).toHaveLength(4);
    expect(screen.getByText(/carries no misconception/)).toBeInTheDocument();
  });

  it('moves the misconception box when the correct choice changes', async () => {
    render(<AuthorForm {...props} />);
    const radios = screen.getAllByRole('radio', { name: 'correct' });
    await userEvent.click(radios[2] as HTMLElement);
    expect(screen.queryByLabelText('Misconception for choice C')).toBeNull();
    expect(screen.getByLabelText('Misconception for choice A')).toBeInTheDocument();
  });

  it('counts the words in the statement and the hints, against the authoring caps', async () => {
    render(<AuthorForm {...props} />);
    await userEvent.type(screen.getByLabelText(/Statement/), 'One two three');
    expect(screen.getAllByText(/^3 words$/).length).toBeGreaterThan(0);
  });

  it('disables the pull request link until the draft is valid', () => {
    render(<AuthorForm {...props} />);
    const link = screen.getByRole('link', { name: /open a pull request/i });
    expect(link).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the path the file has to live at', () => {
    render(<AuthorForm {...props} />);
    expect(screen.getByText('content/problems/3-4/KA-9001.json')).toBeInTheDocument();
  });

  it('warns immediately about a duplicate id', async () => {
    render(<AuthorForm {...props} />);
    const id = screen.getByLabelText(/^Id$/);
    await userEvent.clear(id);
    await userEvent.type(id, 'KA-0001');
    expect(screen.getByRole('status')).toHaveTextContent(/already used/);
  });

  it('announces validity changes without moving focus', () => {
    render(<AuthorForm {...props} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('has no axe violations in either theme', async () => {
    const { container } = render(<AuthorForm {...props} />);
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
