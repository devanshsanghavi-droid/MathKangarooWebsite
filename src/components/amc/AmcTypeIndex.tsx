'use client';

import { useState } from 'react';
import Link from '@/components/AppLink';
import { Badge, Card, SegmentedControl } from '@/components/ui';
import { AmcGroupProgress, type AmcProblemRef } from './AmcGroupProgress';

export interface AmcTypeSummary {
  id: string;
  name: string;
  description: string;
  /** The first "recognize when" cue, shown as a teaser on the card. */
  cue: string;
  areas: Array<{ id: string; name: string }>;
  problems: AmcProblemRef[];
}

/**
 * The problem-type index on /amc/types: one card per recurring competition pattern, with an
 * area filter. A type can belong to several areas (casework turns up everywhere), so the filter
 * is "appears in", not a partition. The filter is a set of buttons, never links (docs/06 §3).
 */
export function AmcTypeIndex({
  types,
  areas,
}: {
  types: AmcTypeSummary[];
  areas: Array<{ id: string; name: string }>;
}) {
  const [area, setArea] = useState('all');
  const shown = area === 'all' ? types : types.filter((t) => t.areas.some((a) => a.id === area));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Show types that appear in"
          showLabel
          className="min-w-0 max-w-full"
          size="sm"
          options={[
            { value: 'all', label: 'All areas' },
            ...areas.map((entry) => ({ value: entry.id, label: entry.name })),
          ]}
          value={area}
          onChange={setArea}
        />
        <p className="ui m-0 text-xs text-ink-2 tabular-nums" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'type' : 'types'}
        </p>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((type) => (
          <li key={type.id} className="min-w-0">
            <Card as="article" interactive className="relative flex h-full flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {type.areas.map((entry) => (
                  <Badge key={entry.id}>{entry.name}</Badge>
                ))}
              </div>
              <h2 className="m-0 text-lg">
                <Link
                  href={`/amc/type/${type.id}`}
                  className="text-ink no-underline after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline"
                >
                  {type.name}
                </Link>
              </h2>
              <p className="m-0 text-sm text-ink-2">{type.description}</p>
              <p className="ui m-0 text-xs text-ink-3">
                <span className="font-semibold text-ink-2">Reach for it when: </span>
                {type.cue}
              </p>
              <div className="mt-auto">
                <AmcGroupProgress
                  problems={type.problems}
                  label={`${type.name}: solved`}
                  hideLabel
                />
                <p className="ui m-0 mt-1.5 text-2xs text-ink-3 tabular-nums">
                  {type.problems.length} {type.problems.length === 1 ? 'problem' : 'problems'}
                </p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
