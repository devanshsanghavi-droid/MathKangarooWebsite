'use client';

import { MasteryDot } from './MasteryDot';
import { useProgress } from './useProgress';
import { masteryStateFor } from '@/lib/local-progress';

/**
 * A mastery dot for one skill, readable from a server component.
 *
 * The list view of the Atlas renders 91 skills on the server — passing every Skill object
 * across the client boundary to draw a dot would put every definition and every misconception
 * into the page payload. So the boundary is drawn here instead, at the dot: the id crosses,
 * nothing else does. All instances share one cached read of localStorage; see useProgress.
 */
export function SkillMasteryDot({
  skillId,
  showLabel = false,
  size = 'sm',
}: {
  skillId: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const progress = useProgress();
  return (
    <MasteryDot
      state={masteryStateFor(progress, skillId, new Date())}
      showLabel={showLabel}
      size={size}
    />
  );
}
