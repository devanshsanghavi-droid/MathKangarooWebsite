import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { KaSectionApp } from '@/components/exam-runner/KaSectionApp';
import { ExamPageShell, examMetadata } from '@/components/exam-runner/exam-pages';
import { SECTION_TEST_SIZE } from '@/lib/exam-engine';

/**
 * `/practice/section` - 10 timed Kangaroo problems from one strand at one level (docs/07
 * section 4). Static; the bank is read in the browser from /data/ka-index.json.
 */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return examMetadata({
    title: 'Section test',
    description:
      `${SECTION_TEST_SIZE} timed problems from one strand at your level, scored like the real ` +
      'paper, then every mistake explained. Original problems, free, no account.',
    path: '/practice/section',
  });
}

export default function PracticeSectionPage() {
  return (
    <ExamPageShell
      eyebrow="Practice"
      title="Section test"
      description={
        <>
          One strand at a time, timed, with a report that names the skills to work on. For the whole
          paper, <Link href="/practice/mock">sit a mock exam</Link>.
        </>
      }
      facts={[
        ['Questions', `${SECTION_TEST_SIZE} from the level and strand you choose, 3 to 5 points`],
        ['Time', 'The sum of each problem’s usual time, rounded up to the minute'],
        ['Scoring', 'Each problem is worth its points; a wrong answer costs nothing'],
      ]}
      math={false}
    >
      <KaSectionApp />
    </ExamPageShell>
  );
}
