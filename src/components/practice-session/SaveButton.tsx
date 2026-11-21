'use client';

import { useProgress } from '@/components/mastery/useProgress';
import { Button } from '@/components/ui';
import { SAVABLE_PROBLEM_ID_RE, isSaved, toggleSaved } from '@/lib/local-progress';

/**
 * "Save" / "Saved" on a question (docs/08 item 10). A toggle button (`aria-pressed`), like
 * "Mark for review" beside it. The saved list lives in the progress file (local-progress.ts),
 * so it syncs with the rest of the progress and the bank's "Saved" filter sees it at once.
 *
 * Reads through useProgress, whose server snapshot is empty, so the prerendered HTML always
 * says "Save" and hydration never disagrees. Ids outside KA / AM / SA / AC render nothing.
 */
export function SaveButton({ problemId }: { problemId: string }) {
  const file = useProgress();
  if (!SAVABLE_PROBLEM_ID_RE.test(problemId)) return null;
  const saved = isSaved(problemId, file);
  return (
    <Button
      size="sm"
      variant={saved ? 'primary' : 'secondary'}
      aria-pressed={saved}
      onClick={() => toggleSaved(problemId)}
      leadingIcon={<span aria-hidden="true">{saved ? '★' : '☆'}</span>}
    >
      {saved ? 'Saved' : 'Save'}
    </Button>
  );
}
