import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { BetaBadge } from '@/components/ui';
import { AmcSectionApp } from '@/components/exam-runner/AmcExams';
import { ExamPageShell, examMetadata } from '@/components/exam-runner/exam-pages';
import { SECTION_TEST_SIZE } from '@/lib/exam-engine';

/** `/amc/section` - 10 timed problems from one area of one AMC paper (docs/07 section 4). */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return examMetadata({
    title: 'AMC section test (beta)',
    description:
      `${SECTION_TEST_SIZE} timed AMC 8, AMC 10 or AMC 12 style problems from one area, early ` +
      'to late slots, scored the real way, with every mistake explained. Original problems.',
    path: '/amc/section',
  });
}

export default function AmcSectionPage() {
  return (
    <ExamPageShell
      eyebrow={
        <>
          AMC 8, AMC 10 and AMC 12 <BetaBadge />
        </>
      }
      title="AMC section test"
      description={
        <>
          Check one area at a time with the same report as the full paper. Ready for all 25? Take{' '}
          <Link href="/amc/mock">a mock exam</Link>.
        </>
      }
      facts={[
        [
          'Questions',
          `${SECTION_TEST_SIZE} from the paper and area you choose, early to late slots`,
        ],
        ['Time', 'The sum of each problem’s usual time, rounded up to the minute'],
        ['Scoring', 'As on the paper: AMC 8 1 per right answer; AMC 10 and 12 6 / 1.5 / 0'],
      ]}
      math
    >
      <AmcSectionApp />
    </ExamPageShell>
  );
}
