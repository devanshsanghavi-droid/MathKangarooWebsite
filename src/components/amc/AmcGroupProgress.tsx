'use client';

import { useProgress } from '@/components/mastery/useProgress';
import { ProgressBar } from '@/components/ui';
import { amcBankProgress } from '@/lib/progress-summary';

export interface AmcProblemRef {
  id: string;
  slot: number;
}

/**
 * Solved / total over a fixed list of AMC problems (an area, a topic, a problem type), read
 * from the signed-out progress store. Server-renders as 0 solved and fills in after mount, so
 * the prerendered card already shows how many problems there are.
 */
export function AmcGroupProgress({
  problems,
  label,
  hideLabel = false,
  size = 'sm',
  className,
}: {
  problems: readonly AmcProblemRef[];
  label: string;
  hideLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const file = useProgress();
  const progress = amcBankProgress(file, problems);
  return (
    <ProgressBar
      value={progress.solved}
      max={progress.total}
      label={label}
      hideLabel={hideLabel}
      size={size}
      {...(className ? { className } : {})}
    />
  );
}
