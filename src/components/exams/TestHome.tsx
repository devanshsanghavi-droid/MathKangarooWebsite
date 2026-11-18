'use client';

import { useMemo, useState } from 'react';
import { useProgress } from '@/components/mastery/useProgress';
import { Button, ButtonLink, Card, ProgressBar } from '@/components/ui';
import { testStatusOf } from '@/lib/progress-summary';
import { practiceSetHref } from '@/lib/practice-item';
import { TEST_DIFFICULTIES, TEST_DIFFICULTY_LABEL, TEST_SLUG, type StdTest } from '@/lib/test-meta';
import {
  TEST_MIXED_SET_SIZE,
  testGroupProgress,
  testMixedSetIds,
  type TestHomeProblem,
} from '@/lib/test-home';
import { TEST_AREAS } from './test-area';

export interface TestHomeDomain {
  id: string;
  name: string;
  description: string;
  skills: Array<{ id: string; name: string }>;
}

export interface TestHomeProps {
  test: StdTest;
  /** One light row per problem, baked in at build time. */
  problems: TestHomeProblem[];
  /** Taxonomy order. */
  domains: TestHomeDomain[];
}

/**
 * The interactive half of /sat and /act (docs/07 section 4): solved counts overall and by
 * difficulty, the three ways in (mock, section test, bank), "Start a mixed set", and one card
 * per domain with its skills' solved counts and a set from that domain alone.
 *
 * Everything is computed in the browser from the problem list the server baked in and the
 * signed-out progress store (the `sat:` / `act:` buckets), so the page stays static. The
 * server render shows the counts with nothing solved.
 */
export function TestHome({ test, problems, domains }: TestHomeProps) {
  const area = TEST_AREAS[test];
  const slug = TEST_SLUG[test];
  const file = useProgress();
  const [message, setMessage] = useState('');

  const statuses = useMemo(
    () => new Map(problems.map((problem) => [problem.id, testStatusOf(file, problem.id)])),
    [file, problems],
  );
  const overall = testGroupProgress(problems, statuses);

  const start = (domain?: TestHomeDomain) => {
    const ids = testMixedSetIds(problems, statuses, domain ? { domain: domain.id } : {});
    if (ids.length === 0) {
      setMessage(
        domain
          ? `There are no questions in ${domain.name} yet.`
          : 'There are no questions in the bank yet.',
      );
      return;
    }
    const name = domain ? `${area.short} ${domain.name}` : `Mixed ${area.short} set`;
    window.location.assign(practiceSetHref({ bank: slug, ids, name: name.slice(0, 60) }));
  };

  return (
    <div className="grid gap-6">
      <Card padding="lg" className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center">
          <div className="ui">
            <p className="m-0 text-xs font-semibold text-ink-2">In the {area.name} bank</p>
            <p className="m-0 mt-1 text-3xl font-semibold text-ink tabular-nums">
              {overall.solved}
              <span className="ml-2 text-base font-normal text-ink-2">
                of {overall.total} solved
              </span>
            </p>
            <p className="m-0 mt-1 text-xs text-ink-3">
              A mixed set takes unsolved questions from every {area.sectionNoun}, easiest first.
            </p>
          </div>
          <div className="grid gap-3">
            {TEST_DIFFICULTIES.map((difficulty) => {
              const row = testGroupProgress(
                problems.filter((problem) => problem.difficulty === difficulty),
                statuses,
              );
              return (
                <ProgressBar
                  key={difficulty}
                  value={row.solved}
                  max={row.total}
                  label={TEST_DIFFICULTY_LABEL[difficulty]}
                />
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => start()} disabled={problems.length === 0}>
            Start a mixed set ({Math.min(TEST_MIXED_SET_SIZE, problems.length)})
          </Button>
          <ButtonLink href={`/${slug}/problems`}>Browse the bank</ButtonLink>
        </div>
        <p className="ui m-0 text-xs text-ink-3" aria-live="polite">
          {message}
        </p>
      </Card>

      <section aria-labelledby={`${slug}-ways-heading`} className="grid gap-3">
        <h2 id={`${slug}-ways-heading`} className="m-0 text-xl">
          Ways to practice
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          <WayCard
            title="Full mock test"
            body={`A timed practice test in the real format: ${area.mockFormat}. Your score and what to work on at the end.`}
            href={`/${slug}/mock`}
            action="Take a mock test"
          />
          <WayCard
            title="Section test"
            body={`Ten timed questions from one ${area.sectionNoun}, when you want to check a single area.`}
            href={`/${slug}/section`}
            action="Take a section test"
          />
          <WayCard
            title="Question bank"
            body="Every question, filtered by skill, difficulty and what you have solved. Untimed."
            href={`/${slug}/problems`}
            action="Open the bank"
          />
        </ul>
      </section>

      <section aria-labelledby={`${slug}-domains-heading`} className="grid gap-3">
        <h2 id={`${slug}-domains-heading`} className="m-0 text-xl">
          By {area.sectionNoun}
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
          {domains.map((domain) => {
            const inDomain = problems.filter((problem) => problem.domain === domain.id);
            const progress = testGroupProgress(inDomain, statuses);
            const skills = domain.skills
              .map((skill) => ({
                ...skill,
                progress: testGroupProgress(
                  inDomain.filter((problem) => problem.skill === skill.id),
                  statuses,
                ),
              }))
              .filter((skill) => skill.progress.total > 0);
            return (
              <li key={domain.id} className="min-w-0">
                <Card as="article" className="flex h-full flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="m-0 text-lg">{domain.name}</h3>
                    <span className="ui text-xs text-ink-2 tabular-nums">
                      {inDomain.length} {inDomain.length === 1 ? 'question' : 'questions'}
                    </span>
                  </div>
                  <p className="m-0 text-sm text-ink-2">{domain.description}</p>
                  <ProgressBar
                    value={progress.solved}
                    max={progress.total}
                    label={`${domain.name}: solved`}
                    size="md"
                  />
                  {skills.length > 0 ? (
                    <details>
                      <summary className="ui cursor-pointer text-xs font-semibold text-accent-700">
                        Skills ({skills.length})
                      </summary>
                      <ul className="m-0 mt-2 grid list-none gap-2 p-0">
                        {skills.map((skill) => (
                          <li key={skill.id}>
                            <ProgressBar
                              value={skill.progress.solved}
                              max={skill.progress.total}
                              label={skill.name}
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  <div className="mt-auto">
                    <Button
                      size="sm"
                      onClick={() => start(domain)}
                      disabled={inDomain.length === 0}
                    >
                      Practice this {area.sectionNoun}
                      <span className="visually-hidden">: {domain.name}</span>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function WayCard({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <li className="min-w-0">
      <Card as="article" className="flex h-full flex-col gap-3">
        <h3 className="m-0 text-lg">{title}</h3>
        <p className="m-0 flex-1 text-sm text-ink-2">{body}</p>
        <div>
          <ButtonLink href={href} size="sm">
            {action}
          </ButtonLink>
        </div>
      </Card>
    </li>
  );
}
