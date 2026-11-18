import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { BetaBadge } from '@/components/ui';
import { AmcMockApp } from '@/components/exam-runner/AmcExams';
import { ExamPageShell, examMetadata } from '@/components/exam-runner/exam-pages';

/**
 * `/amc/mock` - a full timed AMC 8, AMC 10 or AMC 12 paper (docs/07 section 4). Static: the
 * paper is drawn in the browser from /data/amc-index.json, one problem per slot.
 */
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  return examMetadata({
    title: 'AMC mock exam (beta)',
    description:
      'A free timed AMC 8, AMC 10 or AMC 12 practice paper from original problems: 25 ' +
      'questions in the real time, scored the real way, with every mistake explained after.',
    path: '/amc/mock',
  });
}

export default function AmcMockPage() {
  return (
    <ExamPageShell
      eyebrow={
        <>
          AMC 8, AMC 10 and AMC 12 <BetaBadge />
        </>
      }
      title="AMC mock exam"
      description={
        <>
          A full paper of original problems, timed, then a report that shows where the points went.
          For one area at a time, take <Link href="/amc/section">a section test</Link> instead.
        </>
      }
      facts={[
        [
          'AMC 8',
          '25 questions, 40 minutes, 1 point per right answer, nothing off for a wrong one',
        ],
        [
          'AMC 10 and 12',
          '25 questions, 75 minutes, 6 per right answer, 1.5 per blank, 0 per wrong',
        ],
        ['The paper', 'One problem for each position 1 to 25, easiest first'],
      ]}
      math
    >
      <AmcMockApp />
    </ExamPageShell>
  );
}
