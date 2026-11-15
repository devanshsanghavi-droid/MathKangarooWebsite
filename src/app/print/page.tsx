import type { Metadata } from 'next';
import { getAllProblems, getSkill } from '@/lib/content';
import { DEFAULT_WORKSHEET, selectProblems } from '@/lib/worksheet';
import { kaPracticeItem } from '@/lib/practice-item';
import { WorksheetBuilder } from '@/components/print/WorksheetBuilder';
import { PageContainer } from '@/components/ui';

/**
 * `/print` - the worksheet builder: a worksheet and its answer key, on one page.
 *
 * Static (docs/06 §3). It used to read searchParams on the server, so every control was a new
 * worker render. Now the default sheet is baked in at build time and every change is applied
 * in the browser over the static bank index; see <WorksheetBuilder>.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Worksheet generator',
  description:
    'Build a printable worksheet from the problem bank, with an answer key that gives the ' +
    'misconception behind every wrong choice.',
  alternates: { canonical: '/print' },
  // A generator, not content: neither index it nor follow it.
  robots: { index: false, follow: false },
};

export default function PrintPage() {
  const problems = getAllProblems();
  const { selected, available } = selectProblems(problems, DEFAULT_WORKSHEET);
  const initialItems = selected.map((problem) =>
    kaPracticeItem(problem, (id) => getSkill(id)?.name),
  );

  return (
    <PageContainer width="reading">
      <div className="no-print">
        <h1 className="m-0 text-2xl">Worksheet generator</h1>
        <p className="prose-measure mt-3 mb-6 text-ink-2">
          Pick what you want, print the page. The answer key comes with it, on its own sheet, and it
          tells you the mistake behind every wrong choice - not just which letter is right.
        </p>
      </div>
      <WorksheetBuilder
        initialItems={initialItems}
        initialAvailable={available}
        total={problems.length}
      />
    </PageContainer>
  );
}
