'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useProgress } from '@/components/mastery/useProgress';
import { Button, ButtonLink, Card, ProgressBar, SegmentedControl, StatTile } from '@/components/ui';
import type { AmcFormulaContest } from '@/lib/amc-schemas';
import { AMC_TIERS, AMC_TIER_POINTS, AMC_TIER_SLOTS } from '@/lib/amc-tier';
import { mixedSetIds, onPaper, MIXED_SET_SIZE, type AmcHomeProblem } from '@/lib/amc-home';
import { amcBankProgress, amcStatusOf } from '@/lib/progress-summary';
import { practiceSetHref } from '@/lib/practice-item';

export interface AmcHomeArea {
  id: string;
  name: string;
  description: string;
  topics: Array<{ id: string; name: string; amc12Only: boolean }>;
}

/** Per-viewer convenience only: which paper the landing opens on. */
const PAPER_KEY = 'ka-amc-paper';

function readPaper(): AmcFormulaContest | null {
  try {
    const value = window.localStorage.getItem(PAPER_KEY);
    return value === 'AMC10' || value === 'AMC12' ? value : null;
  } catch {
    return null;
  }
}

function writePaper(value: AmcFormulaContest): void {
  try {
    window.localStorage.setItem(PAPER_KEY, value);
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
}

/**
 * The AMC beta landing's interactive half (docs/06 §5): an AMC 10 / AMC 12 switch, the
 * student's progress on that paper overall and by tier, one card per area with its topics'
 * solved counts, and "Start a mixed set". Everything is computed in the browser from the
 * problem list the server baked in and the signed-out progress store, so the page stays
 * static. The server render shows the counts with nothing solved.
 */
export function AmcHome({
  problems,
  areas,
  formulaCount,
  mustKnowCount,
  typeCount,
}: {
  problems: AmcHomeProblem[];
  areas: AmcHomeArea[];
  formulaCount: number;
  mustKnowCount: number;
  typeCount: number;
}) {
  const [paper, setPaper] = useState<AmcFormulaContest>('AMC10');
  const file = useProgress();

  useEffect(() => {
    const saved = readPaper();
    if (saved) setPaper(saved);
  }, []);

  const choose = (value: AmcFormulaContest) => {
    setPaper(value);
    writePaper(value);
  };

  const onThisPaper = useMemo(() => problems.filter((p) => onPaper(p, paper)), [problems, paper]);
  const overall = amcBankProgress(file, onThisPaper);
  const paperName = paper === 'AMC10' ? 'AMC 10' : 'AMC 12';

  const startMixed = () => {
    const statuses = new Map(onThisPaper.map((p) => [p.id, amcStatusOf(file, p.id)]));
    const ids = mixedSetIds(problems, statuses, paper, MIXED_SET_SIZE);
    if (ids.length === 0) return;
    window.location.assign(practiceSetHref({ bank: 'amc', ids, name: `Mixed ${paperName} set` }));
  };

  return (
    <div className="grid gap-6">
      <Card padding="lg" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SegmentedControl
            label="Paper"
            showLabel
            options={[
              { value: 'AMC10', label: 'AMC 10' },
              { value: 'AMC12', label: 'AMC 12' },
            ]}
            value={paper}
            onChange={choose}
          />
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/amc/problems">Browse the bank</ButtonLink>
            <Button variant="primary" onClick={startMixed} disabled={onThisPaper.length === 0}>
              Start a mixed set ({Math.min(MIXED_SET_SIZE, onThisPaper.length)})
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
          <div className="ui">
            <p className="m-0 text-xs font-semibold text-ink-2">On the {paperName}</p>
            <p className="m-0 mt-1 text-3xl font-semibold text-ink tabular-nums">
              {overall.solved}
              <span className="ml-2 text-base font-normal text-ink-2">
                of {overall.total} solved
              </span>
            </p>
            <p className="m-0 mt-1 text-xs text-ink-3">
              A mixed set takes unsolved problems from every area, easiest first.
            </p>
          </div>
          <div className="grid gap-3">
            {AMC_TIERS.map((tier) => {
              const row = overall.byTier.find((entry) => entry.points === AMC_TIER_POINTS[tier]);
              const [from, to] = AMC_TIER_SLOTS[tier];
              return (
                <ProgressBar
                  key={tier}
                  value={row?.solved ?? 0}
                  max={row?.total ?? 0}
                  label={`${tier} (slots ${from}-${to})`}
                />
              );
            })}
          </div>
        </div>
      </Card>

      <section aria-labelledby="amc-areas-heading" className="grid gap-3">
        <h2 id="amc-areas-heading" className="m-0 text-xl">
          By area
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {areas.map((area) => {
            const inArea = onThisPaper.filter((p) => p.area === area.id);
            const progress = amcBankProgress(file, inArea);
            const topics = area.topics
              .filter((topic) => paper === 'AMC12' || !topic.amc12Only)
              .map((topic) => ({
                ...topic,
                progress: amcBankProgress(
                  file,
                  inArea.filter((p) => p.topic === topic.id),
                ),
              }))
              .filter((topic) => topic.progress.total > 0);
            return (
              <li key={area.id} className="min-w-0">
                <Card as="article" className="flex h-full flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="m-0 text-lg">{area.name}</h3>
                    <span className="ui text-xs text-ink-2 tabular-nums">
                      {inArea.length} {inArea.length === 1 ? 'problem' : 'problems'}
                    </span>
                  </div>
                  <p className="m-0 text-sm text-ink-2">{area.description}</p>
                  <ProgressBar
                    value={progress.solved}
                    max={progress.total}
                    label={`${area.name}: solved`}
                    size="md"
                  />
                  {topics.length > 0 ? (
                    <details>
                      <summary className="ui cursor-pointer text-xs font-semibold text-accent-700">
                        Topics ({topics.length})
                      </summary>
                      <ul className="m-0 mt-2 grid list-none gap-2 p-0">
                        {topics.map((topic) => (
                          <li key={topic.id}>
                            <ProgressBar
                              value={topic.progress.solved}
                              max={topic.progress.total}
                              label={topic.name}
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="amc-tools-heading" className="grid gap-3">
        <h2 id="amc-tools-heading" className="m-0 text-xl">
          Learn the toolkit
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            label="Must-know formulas"
            value={mustKnowCount}
            detail={`${formulaCount} formulas on the sheet in all`}
            footer={
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/amc/formulas" size="sm">
                  Formula sheet
                </ButtonLink>
                <ButtonLink href="/amc/formulas/drill" size="sm" variant="ghost">
                  Flashcards
                </ButtonLink>
              </div>
            }
          />
          <StatTile
            label="Problem types"
            value={typeCount}
            detail="Recurring patterns, with the cues that give each away"
            footer={
              <ButtonLink href="/amc/types" size="sm">
                See the problem types
              </ButtonLink>
            }
          />
          <Card className="ui grid content-start gap-2">
            <p className="m-0 text-2xs font-semibold tracking-wide text-ink-2 uppercase">
              How the beta works
            </p>
            <p className="m-0 text-sm text-ink-2">
              Every problem is written from scratch, never taken from a real AMC paper. Each wrong
              answer explains the mistake that produces it, as in the{' '}
              <Link href="/problems">Kangaroo bank</Link>. Progress stays in this browser.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
