import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui';
import { ProgressAnalytics } from '@/components/progress/ProgressAnalytics';
import { progressBanks } from '@/lib/progress-page-data';

/**
 * `/progress` (docs/07 section 5). Static: the page ships each bank's sections and a compact
 * problem-to-section map built here at build time, and the browser fills in the numbers from
 * the student's own progress file. Signed out it reads this browser; signed in, ProgressSync
 * has already merged the account copy into the same file.
 *
 * Out of the index: the HTML is the same empty shell for every visitor, and a crawler has no
 * progress to show.
 */
export const dynamic = 'force-static';

const DESCRIPTION =
  'Your accuracy in each section of Kangaroo, AMC, SAT and ACT practice, which sections are ' +
  'worth more work, and how the last twelve weeks have gone. No account needed.';

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
        description="How each section is going, what is worth more practice, and how the last twelve weeks compare. Only your own answers, never anyone else's."
      />
      <ProgressAnalytics banks={progressBanks()} />
    </PageContainer>
  );
}
