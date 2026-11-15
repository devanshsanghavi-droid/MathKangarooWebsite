import { PageContainer } from '@/components/ui';

/**
 * The route-level loading state. It is deliberately a static block rather than a spinner:
 * an animation that respects prefers-reduced-motion but still moves is worse than text for a
 * page that usually appears in well under a second. The grey blocks sketch the card layout the
 * page is about to fill, so nothing jumps when it arrives.
 */
export default function Loading() {
  return (
    <PageContainer>
      <p role="status" className="ui m-0 text-sm text-ink-2">
        Loading...
      </p>
      <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-card border border-rule bg-surface" />
        <div className="h-28 rounded-card border border-rule bg-surface" />
        <div className="h-28 rounded-card border border-rule bg-surface" />
      </div>
      <div aria-hidden="true" className="mt-4 h-64 rounded-card border border-rule bg-surface" />
    </PageContainer>
  );
}
