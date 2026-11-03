import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth/current';
import { signOut } from '../login/actions';
import { contentHealth } from '@/lib/analytics/content-health';
import { PUBLISH_MIN_N } from '@/lib/analytics/item-analysis';
import { DifficultyPill } from '@/components/DifficultyPill';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The operator dashboard.
 *
 * It re-checks the session rather than trusting the middleware that already did. See the note
 * in src/middleware.ts: middleware has been bypassable, and authorisation that exists in only
 * one place is authorisation that can be skipped in one step.
 */
export default async function AdminPage() {
  const session = await currentSession();
  if (session?.role !== 'admin') redirect('/login');

  const health = contentHealth();
  const covered = health.skills - health.uncovered.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="eyebrow mono m-0 text-2xs text-ink-3">Operator</p>
          <h1 className="mt-1 mb-0 text-2xl">Admin</h1>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="tap-target ui cursor-pointer rounded-sm border border-rule-strong bg-surface px-3 text-sm text-ink-2"
          >
            Sign out
          </button>
        </form>
      </header>

      {/* ---------------------------------------------------------------- content */}
      <section aria-labelledby="bank" className="mt-8">
        <h2 id="bank" className="m-0 text-lg">
          The bank, right now
        </h2>
        <p className="mt-1 mb-3 text-sm text-ink-3">
          Counted from the content files at build time. True whether or not anyone has visited.
        </p>
        <dl className="m-0 grid gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-4">
          {[
            ['Skills', health.skills],
            ['Problems', health.problems],
            ['Distractor explanations', health.distractors],
            ['Figures', health.figures],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-surface p-4">
              <dt className="m-0 text-2xs text-ink-3">{label}</dt>
              <dd className="mono m-0 mt-1 text-2xl font-semibold text-ink tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------------------------------------------------------- gaps */}
      <section aria-labelledby="gaps" className="mt-8">
        <h2 id="gaps" className="m-0 text-lg">
          Where the gaps are
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-rule bg-surface p-4">
            <h3 className="m-0 text-sm font-semibold text-ink">Skills with no problems</h3>
            {health.uncovered.length === 0 ? (
              <p className="mt-2 mb-0 text-sm text-ink-2">
                None. All {health.skills} skills have at least one problem.
              </p>
            ) : (
              <ul className="mono mt-2 mb-0 flex list-none flex-wrap gap-2 p-0 text-xs">
                {health.uncovered.map((id) => (
                  <li key={id}>
                    <Link href={`/skill/${id}`}>{id}</Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 mb-0 text-2xs text-ink-3">
              {covered} of {health.skills} covered.
            </p>
          </div>

          <div className="rounded-md border border-rule bg-surface p-4">
            <h3 className="m-0 text-sm font-semibold text-ink">Ladders on a single tier</h3>
            <p className="mt-1 mb-2 text-xs text-ink-3">
              Practisable, but not progressively - there is nowhere to move up to.
            </p>
            {health.singleTier.length === 0 ? (
              <p className="m-0 text-sm text-ink-2">None.</p>
            ) : (
              <ul className="m-0 grid max-h-48 list-none gap-1 overflow-y-auto p-0 text-xs">
                {health.singleTier.map((entry) => (
                  <li key={entry.skillId} className="flex items-center gap-2">
                    <Link href={`/skill/${entry.skillId}`} className="mono">
                      {entry.skillId}
                    </Link>
                    <DifficultyPill points={entry.points} />
                    <span className="text-ink-3">{entry.count} problems</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-md border border-rule bg-surface p-4">
          <h3 className="m-0 text-sm font-semibold text-ink">Spread across the point tiers</h3>
          <ul className="m-0 mt-3 grid list-none gap-2 p-0">
            {health.byTier.map((tier) => (
              <li key={tier.points} className="flex items-center gap-3">
                <DifficultyPill points={tier.points} />
                <span
                  aria-hidden="true"
                  className="h-2 rounded-lg bg-accent-600"
                  style={{ width: `${Math.round(tier.share * 100) * 3}px` }}
                />
                <span className="mono text-xs text-ink-2 tabular-nums">
                  {tier.problems} ({Math.round(tier.share * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>

        {health.pendingReview > 0 ? (
          <p className="mt-4 mb-0 rounded-md border-2 border-rule-strong bg-surface-3 p-3 text-sm text-ink">
            <strong>{health.pendingReview}</strong> problems still carry{' '}
            <code className="mono">pending-review</code>. The content guide asks for two approvals
            before a problem is merged for launch.
          </p>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- telemetry */}
      <section aria-labelledby="usage" className="mt-8">
        <h2 id="usage" className="m-0 text-lg">
          How it is being used
        </h2>
        <div className="mt-3 rounded-md border border-dashed border-rule-strong bg-surface-2 p-5">
          <p className="reading m-0 max-w-prose text-ink-2">
            No usage data yet. Events are collected the moment the site is deployed and someone
            visits - entry points, the learning funnel, error rates per skill and tier, feature
            adoption, and per-distractor item analysis.
          </p>
          <p className="reading mt-3 mb-0 max-w-prose text-sm text-ink-3">
            Nothing is shown here until at least {PUBLISH_MIN_N} students have contributed to a
            figure. That is not a placeholder threshold: on a cohort of sixty, a quartile computed
            from eight students identifies a person.
          </p>
          <p className="mt-3 mb-0 text-2xs text-ink-3">
            Aggregation is implemented and tested in{' '}
            <code className="mono">src/lib/analytics/</code>; it needs the events table connected
            before it has anything to aggregate.
          </p>
        </div>
      </section>

      <p className="mt-10 mb-0 text-2xs text-ink-3">
        Signed in as {session.sub}. Sessions last eight hours; rotating{' '}
        <code className="mono">AUTH_SECRET</code> ends every one of them immediately.
      </p>
    </div>
  );
}
