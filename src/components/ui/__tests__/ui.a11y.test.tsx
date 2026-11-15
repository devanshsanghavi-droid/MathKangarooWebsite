import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import {
  Accordion,
  AccordionItem,
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
} from '..';

const noop = () => {};

/** Every v3 primitive on one page, the way the bank and home will compose them. */
function Gallery() {
  return (
    <main>
      <PageContainer>
        <PageHeader
          title="Question bank"
          eyebrow={<BetaBadge />}
          description="Pick skills, then start."
          actions={
            <>
              <Button variant="primary">Start practice (12)</Button>
              <Button variant="ghost">Random unsolved</Button>
              <ButtonLink href="/atlas">Skill Atlas</ButtonLink>
            </>
          }
        />
        <SegmentedControl
          label="Level"
          options={[
            { value: 'all', label: 'All' },
            { value: '3-4', label: '3-4' },
          ]}
          value="all"
          onChange={noop}
        />
        <Accordion>
          <AccordionItem title="Counting" meta="4 / 18" level={2} defaultOpen>
            <CheckboxRow
              label="Sliding a shape"
              checked
              onCheckedChange={noop}
              count={{ solved: 3, total: 12 }}
            />
            <CheckboxRow
              label="Pairs"
              checked={false}
              onCheckedChange={noop}
              count={7}
              indeterminate
            />
          </AccordionItem>
          <AccordionItem title="Geometry" level={2}>
            <p>Closed</p>
          </AccordionItem>
        </Accordion>
        <div>
          <ToggleChip pressed onPressedChange={noop} count={3}>
            Casework
          </ToggleChip>
          <ToggleChip pressed={false} onPressedChange={noop}>
            Symmetry
          </ToggleChip>
          <Chip>Geometry</Chip>
        </div>
        <Card>
          <CardHeader title="This selection" />
          <ProgressBar label="Selection" value={3} max={12} />
          <ProgressBar label="Hidden label" value={0} max={0} hideLabel />
          <ProgressRing label="Algebra" value={2} max={5} />
        </Card>
        <Panel title="Your numbers">
          <StatTile label="Solved" value={42} detail="of 1,000 problems" />
        </Panel>
        <Tabs
          label="Solutions"
          tabs={[
            { id: 'a', label: 'Reliable', content: <p>One</p> },
            { id: 'b', label: 'Elegant', content: <p>Two</p> },
          ]}
        />
      </PageContainer>
    </main>
  );
}

describe('the v3 primitives', () => {
  it('have no axe violations in either theme', async () => {
    const { container } = render(<Gallery />);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('have no axe violations with the sheet open', async () => {
    const { container } = render(
      <Sheet
        open
        onClose={noop}
        title="Filters"
        footer={<Button variant="primary">Show 12</Button>}
      >
        <CheckboxRow label="Has a figure" checked={false} onCheckedChange={noop} />
      </Sheet>,
    );
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
