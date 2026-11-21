import { ButtonLink } from '@/components/ui';
import type { ProgressFile, SessionRecord } from '@/lib/local-progress';
import { percentLabel, scoreRatio, sessionLabel, sessionReview } from '@/lib/progress-analytics';

/**
 * Finished mocks and section tests, newest first, each with a way back in (docs/08 item 8).
 * Review opens the test's own questions as a practice set when the attempts recorded at its
 * finish time can be found; a test from before attempts carried a mode cannot be rebuilt, so
 * it honestly offers the same kind of test again instead.
 */

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function durationLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? 'under a minute' : `${minutes} min`;
}

export function TestHistory({
  sessions,
  file,
  sectionName,
}: {
  sessions: readonly SessionRecord[];
  file: ProgressFile;
  sectionName: (session: SessionRecord) => string | null;
}) {
  if (sessions.length === 0) {
    return (
      <p className="m-0 text-sm text-ink-2">
        No finished tests yet. A mock or a section test you finish is listed here with its score.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="m-0 text-xs text-ink-2">
        Review opens the questions from that test as a practice set. A test that did not record its
        questions offers a fresh one instead.
      </p>
      <div className="overflow-x-auto" role="region" aria-label="Finished tests table" tabIndex={0}>
        <table className="w-full border-collapse text-left text-sm">
          <caption className="visually-hidden">Finished tests, newest first</caption>
          <thead>
            <tr className="border-b border-rule text-xs text-ink-2">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Date
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Test
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Score
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Right
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Time
              </th>
              <th scope="col" className="py-2 font-semibold">
                <span className="visually-hidden">Review</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const review = sessionReview(file, s);
              const section = sectionName(s);
              const name = `${sessionLabel(s)}, ${dateLabel(s.at)}`;
              return (
                <tr
                  key={`${s.kind}|${s.exam}|${s.at}`}
                  className="border-b border-rule align-middle"
                >
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{dateLabel(s.at)}</td>
                  <td className="py-2 pr-3 text-ink">
                    {sessionLabel(s)}
                    {section ? <span className="block text-xs text-ink-3">{section}</span> : null}
                  </td>
                  <td className="mono py-2 pr-3 whitespace-nowrap text-ink tabular-nums">
                    {s.score} / {s.max}
                    <span className="block text-xs text-ink-3">{percentLabel(scoreRatio(s))}</span>
                  </td>
                  <td className="mono py-2 pr-3 whitespace-nowrap text-ink-2 tabular-nums">
                    {s.correct} / {s.total}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-2">
                    {durationLabel(s.durationMs)}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {review.questions > 0 ? (
                      <ButtonLink href={review.href} variant="secondary" size="sm">
                        Review
                        <span className="visually-hidden">
                          : {name}, {review.questions} questions
                        </span>
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={review.href} variant="secondary" size="sm">
                        Take again<span className="visually-hidden">: {name}</span>
                      </ButtonLink>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
