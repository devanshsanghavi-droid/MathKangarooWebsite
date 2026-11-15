import type { Metadata } from 'next';
import { ButtonLink, Card, PageContainer } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <PageContainer width="reading" className="sm:py-16">
      <Card padding="lg">
        <p className="mono m-0 text-xs text-ink-2">404</p>
        <h1 className="mt-2 mb-0 text-2xl sm:text-3xl">That page does not exist</h1>
        <p className="prose-measure mt-4 mb-0 text-ink-2">
          The link may be out of date, or a skill or problem id may have been mistyped. Ids look
          like <code className="mono">GEO-10</code> for a skill and{' '}
          <code className="mono">KA-0001</code> for a problem.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="primary">
            Go to Practice
          </ButtonLink>
          <ButtonLink href="/problems" variant="secondary">
            Browse the problems
          </ButtonLink>
          <ButtonLink href="/atlas" variant="secondary">
            Browse the Atlas
          </ButtonLink>
        </div>
      </Card>
    </PageContainer>
  );
}
