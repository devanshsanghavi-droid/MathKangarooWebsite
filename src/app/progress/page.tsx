import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui';
import { ProgressAnalytics } from '@/components/progress/ProgressAnalytics';
import { progressBanks } from '@/lib/progress-page-data';
import { demoKaProblems } from './demo-pool';

/**
 * `/progress` (docs/07 section 5, docs/08 items 7 and 8). Static: the page ships each bank's
 * sections and a compact problem-to-section map built here at build time, and the browser fills
 * in the numbers from the student's own progress file. Signed out it reads this browser; signed
 * in, ProgressSync has already merged the account copy into the same file. `?exam=` and
 * `?demo=1` are read in the browser; the demo student is generated there, in memory, from the
 * short Kangaroo list passed here (demo-pool.ts).
 *
 * Out of the index: the HTML is the same empty shell for every visitor, and a crawler has no
 * progress to show.
 */
export const dynamic = 'force-static';

const DESCRIPTION =
  'Your accuracy in each topic of Kangaroo, AMC, SAT and ACT practice, test scores over time, ' +
  'which topics are worth more work, and how the last twelve weeks have gone. No account needed.';

export const metadata: Metadata = {
  title: 'Your progress',
  description: DESCRIPTION,
  alternates: { canonical: '/progress' },
  openGraph: {
    title: 'Your progress',
    description: DESCRIPTION,
    url: '/progress',
    type: 'website',
  },
  robots: { index: false, follow: true },
};

export default function ProgressPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Progress"
        title="Your progress"
        description="How each exam and topic is going, what is worth more practice, and how your tests and weeks compare. Only your own answers, never anyone else's."
      />
      <ProgressAnalytics banks={progressBanks()} demoKa={demoKaProblems()} />
    </PageContainer>
  );
}
