import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Accordion,
  AccordionItem,
  Badge,
  BetaBadge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  CheckboxRow,
  Chip,
  PageContainer,
  PageHeader,
  Panel,
  ProgressBar,
  ProgressRing,
  SegmentedControl,
  Sheet,
  StatTile,
  Tabs,
  ToggleChip,
  buttonClasses,
  percentOf,
  progressValueText,
} from '..';

describe('Card and Panel', () => {
  it('renders a card surface with the card radius', () => {
    render(
      <Card as="section" aria-label="Summary">
        <CardHeader title="Selection" description="12 problems" actions={<Button>Go</Button>} />
      </Card>,
    );
    const card = screen.getByRole('region', { name: 'Summary' });
    expect(card.className).toContain('rounded-card');
    expect(card.className).toContain('bg-surface');
    expect(screen.getByRole('heading', { level: 2, name: 'Selection' })).toBeInTheDocument();
  });

  it('labels a titled panel as a region by its heading', () => {
    render(
      <Panel title="Per-strand progress" level={2}>
        body
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Per-strand progress' })).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Check</Button>);
    expect(screen.getByRole('button', { name: 'Check' })).toHaveAttribute('type', 'button');
  });

  it('gives the primary variant the teal fill and the on-accent ink', () => {
    const classes = buttonClasses({ variant: 'primary' });
    expect(classes).toContain('bg-accent-600');
    expect(classes).toContain('text-on-accent');
    expect(classes).toContain('rounded-control');
  });

  it('keeps md and lg at the 44px tap target', () => {
    expect(buttonClasses({ size: 'md' })).toContain('min-h-11');
    expect(buttonClasses({ size: 'lg' })).toContain('min-h-12');
  });

  it('renders ButtonLink as a link, not a button', () => {
    render(
      <ButtonLink href="/problems" variant="primary">
        Start practice
      </ButtonLink>,
    );
    expect(screen.getByRole('link', { name: 'Start practice' })).toHaveAttribute(
      'href',
      '/problems',
    );
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Next</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Badge, Chip, ToggleChip', () => {
  it('renders a Beta pill in the accent, never a reserved colour', () => {
    render(<BetaBadge />);
    const beta = screen.getByText('Beta');
    expect(beta.className).toContain('rounded-pill');
    expect(beta.className).toContain('text-accent-700');
    expect(beta.className).not.toMatch(/correct|wrong|hint/);
  });

  it('renders a static chip and badge', () => {
    render(
      <>
        <Chip selected>Geometry</Chip>
        <Badge>New</Badge>
      </>,
    );
    expect(screen.getByText('Geometry').className).toContain('bg-accent-100');
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('toggles aria-pressed from the keyboard', async () => {
    function Harness() {
      const [pressed, setPressed] = useState(false);
      return (
        <ToggleChip pressed={pressed} onPressedChange={setPressed} count={14}>
          Casework
        </ToggleChip>
      );
    }
    render(<Harness />);
    const chip = screen.getByRole('button', { name: /Casework/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    chip.focus();
    await userEvent.keyboard(' ');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).toHaveTextContent('14');
  });
});

describe('CheckboxRow', () => {
  it('is a labelled native checkbox with a solved / total count', async () => {
    const onChange = vi.fn();
    render(
      <CheckboxRow
        label="Sliding a shape"
        checked={false}
        onCheckedChange={onChange}
        count={{ solved: 3, total: 12 }}
      />,
    );
    const box = screen.getByRole('checkbox', { name: /Sliding a shape/ });
    expect(box).toHaveAccessibleName(/3 of 12 solved/);
    expect(screen.getByText('3 / 12')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Sliding a shape'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('sets the indeterminate DOM property for a mixed state', () => {
    render(
      <CheckboxRow label="Geometry" checked={false} onCheckedChange={() => {}} indeterminate />,
    );
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
  });
});

describe('SegmentedControl', () => {
  const LEVELS = [
    { value: 'all', label: 'All' },
    { value: '1-2', label: '1-2' },
    { value: '3-4', label: '3-4' },
  ] as const;

  function Harness() {
    const [value, setValue] = useState<(typeof LEVELS)[number]['value']>('all');
    return <SegmentedControl label="Level" options={LEVELS} value={value} onChange={setValue} />;
  }

  it('is a radio group with one tab stop', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Level' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
  });

  it('moves and selects with the arrow keys, wrapping, and Home / End', async () => {
    render(<Harness />);
    screen.getByRole('radio', { name: 'All' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '1-2' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '1-2' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: '3-4' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '3-4' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Accordion', () => {
  function Strands() {
    return (
      <Accordion>
        <AccordionItem title="Counting" meta="4 / 18" defaultOpen>
          <p>Counting skills</p>
        </AccordionItem>
        <AccordionItem title="Geometry" meta="0 / 22">
          <p>Geometry skills</p>
        </AccordionItem>
        <AccordionItem title="Logic">
          <p>Logic skills</p>
        </AccordionItem>
      </Accordion>
    );
  }

  it('wires aria-expanded and aria-controls to a hidden region', async () => {
    render(<Strands />);
    const geometry = screen.getByRole('button', { name: /Geometry/ });
    expect(geometry).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(geometry.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveAttribute('hidden');
    await userEvent.click(geometry);
    expect(geometry).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');
    expect(screen.getByRole('region', { name: /Geometry/ })).toHaveTextContent('Geometry skills');
  });

  it('toggles with Enter and Space and moves between headers with the arrows', async () => {
    render(<Strands />);
    const counting = screen.getByRole('button', { name: /Counting/ });
    counting.focus();
    await userEvent.keyboard('{Enter}');
    expect(counting).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard(' ');
    expect(counting).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /Geometry/ })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: /Logic/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(counting).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: /Logic/ })).toHaveFocus();
  });

  it('supports a controlled open state', async () => {
    const onOpenChange = vi.fn();
    render(
      <AccordionItem title="Algebra" open={false} onOpenChange={onOpenChange}>
        body
      </AccordionItem>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Algebra/ }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: /Algebra/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('ProgressBar and ProgressRing', () => {
  it('exposes value, max and a spoken "3 of 12 solved", and prints the numbers', () => {
    render(<ProgressBar label="Geometry" value={3} max={12} />);
    const bar = screen.getByRole('progressbar', { name: 'Geometry' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '12');
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 12 solved');
    expect(screen.getByText('3 / 12')).toBeInTheDocument();
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('25%');
    expect(fill.className).toContain('bg-accent-600');
  });

  it('keeps its name when the visible label is hidden', () => {
    render(<ProgressBar label="This selection" value={0} max={0} hideLabel />);
    const bar = screen.getByRole('progressbar', { name: 'This selection' });
    expect((bar.firstElementChild as HTMLElement).style.width).toBe('0%');
  });

  it('renders a ring with the percentage in the middle', () => {
    render(<ProgressRing label="Algebra" value={1} max={4} />);
    const ring = screen.getByRole('progressbar', { name: 'Algebra' });
    expect(ring).toHaveAttribute('aria-valuetext', '1 of 4 solved');
    expect(ring).toHaveTextContent('25%');
  });

  it('clamps and never divides by zero', () => {
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(15, 10)).toBe(100);
    expect(percentOf(-1, 10)).toBe(0);
    expect(progressValueText(2, 9, 'done')).toBe('2 of 9 done');
    expect(progressValueText(2, 9, '')).toBe('2 of 9');
  });
});

describe('StatTile', () => {
  it('shows a label, a tabular number and what it counts', () => {
    render(<StatTile label="Solved" value={42} detail="of 1,000 problems" />);
    const value = screen.getByText('42');
    expect(value.className).toContain('tabular-nums');
    expect(screen.getByText('Solved')).toBeInTheDocument();
    expect(screen.getByText('of 1,000 problems')).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  const TABS = [
    { id: 'reliable', label: 'Reliable', content: <p>Step by step</p> },
    { id: 'elegant', label: 'Elegant', content: <p>The shortcut</p> },
    { id: 'video', label: 'Notes', count: 2, content: <p>Notes body</p> },
  ];

  it('follows the tabs pattern with automatic activation', async () => {
    render(<Tabs label="Solutions" tabs={TABS} />);
    expect(screen.getByRole('tablist', { name: 'Solutions' })).toBeInTheDocument();
    const reliable = screen.getByRole('tab', { name: 'Reliable' });
    expect(reliable).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Reliable' })).toHaveTextContent('Step by step');
    reliable.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Elegant' })).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Elegant' })).toHaveTextContent('The shortcut');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Notes/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Sheet', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Filters
        </button>
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title="Filters"
          footer={<Button>Show 12</Button>}
        >
          <CheckboxRow label="Has a figure" checked={false} onCheckedChange={() => {}} />
        </Sheet>
      </>
    );
  }

  it('renders nothing while closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a labelled modal, moves focus in, traps Tab and closes on Escape', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('checkbox', { name: 'Has a figure' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Show 12' })).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Show 12' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('closes when the scrim is clicked', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(screen.getByTestId('sheet-scrim'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('PageContainer and PageHeader', () => {
  it('renders the app column and the page h1', () => {
    const { container } = render(
      <PageContainer>
        <PageHeader title="Question bank" eyebrow={<BetaBadge />} description="All problems" />
      </PageContainer>,
    );
    expect(container.firstElementChild?.className).toContain('max-w-app');
    expect(screen.getByRole('heading', { level: 1, name: 'Question bank' })).toBeInTheDocument();
  });
});
