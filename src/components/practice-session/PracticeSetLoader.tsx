'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { ButtonLink, Card } from '@/components/ui';
import { loadPracticeItems } from '@/lib/bank-client';
import {
  parsePracticeSetQuery,
  type PracticeItem,
  type PracticeSetQuery,
} from '@/lib/practice-item';
import { PracticeSession } from './PracticeSession';

type LoadState =
  | { status: 'reading' }
  | { status: 'empty'; query: PracticeSetQuery }
  | { status: 'loading'; query: PracticeSetQuery }
  | { status: 'error'; query: PracticeSetQuery }
  | {
      status: 'ready';
      query: PracticeSetQuery;
      items: PracticeItem[];
      missing: string[];
      /** KaTeX for an AMC set, loaded only when one is opened. */
      Math: ComponentType<{ children: ReactNode }> | null;
    };

/**
 * `/practice/set` on the client: reads `?ids=` (and `?bank=amc`, `?name=`) from the URL, fetches
 * each `/data/p/<id>.json`, and hands the items to <PracticeSession>.
 *
 * The page itself is static (docs/06 §3), so the query is read here, after mount, rather than
 * on the server. Reading `window.location` in an effect instead of `useSearchParams` keeps the
 * prerendered HTML a plain loading card with no Suspense boundary to bail out of.
 */
export function PracticeSetLoader({ search }: { search?: string }) {
  const [state, setState] = useState<LoadState>({ status: 'reading' });

  useEffect(() => {
    let cancelled = false;
    const query = parsePracticeSetQuery(search ?? window.location.search);
    if (query.ids.length === 0) {
      setState({ status: 'empty', query });
      return;
    }
    setState({ status: 'loading', query });
    // KaTeX only travels with an AMC set: a Kangaroo set has no math and never loads it.
    const math =
      query.bank === 'amc'
        ? import('../math/MathProvider').then((module) => module.MathProvider)
        : Promise.resolve(null);
    Promise.all([loadPracticeItems(query.ids), math])
      .then(([{ items, missing }, Math]) => {
        if (cancelled) return;
        // Never mix banks in one set, whatever the URL says.
        const ofBank = items.filter((item) => item.bank === query.bank);
        if (ofBank.length === 0) setState({ status: 'error', query });
        else setState({ status: 'ready', query, items: ofBank, missing, Math });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', query });
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  if (state.status === 'ready') {
    const { query, items, missing, Math } = state;
    const amc = query.bank === 'amc';
    const session = (
      <PracticeSession
        items={items}
        title={query.name || (amc ? 'AMC practice set' : 'Practice set')}
        exitHref={amc ? '/amc/problems' : '/problems'}
        missing={missing}
      />
    );
    return Math ? <Math>{session}</Math> : session;
  }

  const amc = state.status !== 'reading' && state.query.bank === 'amc';
  const bankHref = amc ? '/amc/problems' : '/problems';

  if (state.status === 'empty' || state.status === 'error') {
    return (
      <Card padding="lg">
        <h2 className="m-0 text-lg">
          {state.status === 'empty' ? 'No questions picked yet' : 'This set could not be loaded'}
        </h2>
        <p className="m-0 mt-2 max-w-prose text-ink-2">
          {state.status === 'empty'
            ? 'A practice set is made from the question bank: choose a level or a few skills there and press Start practice.'
            : 'The questions in this link could not be fetched. Check your connection and reload, or start a new set from the bank.'}
        </p>
        <div className="mt-4">
          <ButtonLink href={bankHref} variant="primary">
            Go to the question bank
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <p className="m-0 text-ink-2" role="status">
        Loading the questions...
      </p>
    </Card>
  );
}
