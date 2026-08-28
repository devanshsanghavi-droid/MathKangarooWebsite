import { SITE } from './site';
import type { Problem } from './schemas';

/**
 * A prefilled GitHub issue for reporting an error in a problem.
 *
 * A public issue rather than a form: it needs no backend, it is auditable, and the person who
 * reported it can watch the fix land. The body is prefilled with everything a maintainer needs
 * to find the file, and nothing about the reporter.
 */
export function reportProblemUrl(problem: Pick<Problem, 'id' | 'band' | 'points'>): string {
  const title = `Problem ${problem.id}: `;
  const body = [
    `**Problem:** ${problem.id} (${problem.points}-point, band ${problem.band})`,
    `**File:** \`content/problems/${problem.band}/${problem.id}.json\``,
    `**Page:** ${SITE.url}/problem/${problem.id}`,
    '',
    '**What is wrong?**',
    '',
    '<!-- Is the answer wrong, a distractor implausible, the figure unclear, the wording -->',
    '<!-- ambiguous, or a hint giving too much away? Be as specific as you can. -->',
    '',
  ].join('\n');

  const query = new URLSearchParams({ title, body, labels: 'problem-error' });
  return `${SITE.repo}/issues/new?${query.toString()}`;
}
