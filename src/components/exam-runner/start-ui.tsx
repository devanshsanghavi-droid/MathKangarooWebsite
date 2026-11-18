'use client';

import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button, ButtonLink, Card, CardHeader } from '@/components/ui';
import { SECTION_TEST_MIN, SECTION_TEST_SIZE } from '@/lib/exam-engine';
import type { StartScreenApi } from './ExamSession';

/** One static file (or several) from public/data, loaded after mount. */
export function useStaticData<T>(load: () => Promise<T>): { data: T | null; failed: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // The loader is a module-level function; running it once per mount is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, failed };
}

/** The query string, read once after mount (the pages are static). */
export function useQueryParams(): URLSearchParams | null {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => {
    setParams(new URLSearchParams(window.location.search));
  }, []);
  return params;
}

export function StartStatus({ loading, failed }: { loading: boolean; failed: boolean }): ReactNode {
  if (failed) {
    return (
      <Card padding="lg">
        <p className="m-0 text-ink-2" role="alert">
          The question bank could not be loaded. Check your connection and reload the page.
        </p>
      </Card>
    );
  }
  if (loading) {
    return (
      <Card padding="lg">
        <p className="m-0 text-ink-2" role="status">
          Loading the question bank...
        </p>
      </Card>
    );
  }
  return null;
}

/** Busy and error lines shared by every start screen. */
export function BeginFeedback({ api }: { api: StartScreenApi }) {
  return (
    <>
      {api.busy ? (
        <p className="ui m-0 mt-3 text-sm text-ink-2" role="status">
          Loading the questions...
        </p>
      ) : null}
      {api.error ? (
        <p className="ui m-0 mt-3 text-sm text-ink" role="alert">
          {api.error}
        </p>
      ) : null}
    </>
  );
}

export const SAVED_NOTE =
  'No account needed. The test is saved on this device, so a refresh, or closing the laptop, ' +
  'brings back your answers, and the timer keeps running as it would in a hall.';

export interface PaperChoice {
  id: string;
  title: string;
  detail: string;
  /** Null when the paper can be built; otherwise why not, in a sentence. */
  unavailable: string | null;
  onStart: () => void;
  /** Drawn as the suggested choice (from a link that named it). */
  suggested?: boolean;
}

/** The mock start screen: one button per paper the bank can fill, and why the others are missing. */
export function PaperChooser({
  title,
  intro,
  choices,
  api,
}: {
  title: string;
  intro: ReactNode;
  choices: readonly PaperChoice[];
  api: StartScreenApi;
}) {
  const headingId = useId();
  return (
    <Card as="section" aria-labelledby={headingId} padding="lg">
      <CardHeader titleId={headingId} title={title} />
      <div className="prose-measure mt-2 text-ink-2">{intro}</div>
      <ul className="m-0 mt-5 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {choices.map((choice) => (
          <li key={choice.id}>
            {choice.unavailable ? (
              <div className="ui flex h-full flex-col gap-1 rounded-control border border-dashed border-rule-strong bg-surface-2 p-4">
                <span className="text-base font-semibold text-ink">{choice.title}</span>
                <span className="text-xs text-ink-2">{choice.detail}</span>
                <span className="mt-1 text-xs text-ink-2">{choice.unavailable}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={choice.onStart}
                disabled={api.busy}
                className={[
                  'ui flex h-full w-full cursor-pointer flex-col items-start gap-1 rounded-control bg-surface p-4 text-left transition-colors hover:border-accent-600 hover:bg-surface-2 disabled:cursor-wait motion-reduce:transition-none',
                  choice.suggested ? 'border-2 border-accent-600' : 'border border-rule-strong',
                ].join(' ')}
              >
                <span className="text-base font-semibold text-ink">Start {choice.title}</span>
                <span className="text-xs text-ink-2">{choice.detail}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <BeginFeedback api={api} />
      <p className="ui mt-4 mb-0 text-xs text-ink-2">{SAVED_NOTE}</p>
    </Card>
  );
}

export interface PickerField {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

/**
 * The section-test start screen: native selects (the most robust keyboard and screen-reader
 * control there is), a live count of what the choice holds, and Start.
 */
export function SectionPicker({
  title,
  intro,
  fields,
  available,
  sectionName,
  onStart,
  api,
  bankHref,
}: {
  title: string;
  intro: ReactNode;
  fields: readonly PickerField[];
  /** Questions the current choice holds. */
  available: number;
  sectionName: string;
  onStart: () => void;
  api: StartScreenApi;
  bankHref: string;
}) {
  const headingId = useId();
  const countId = useId();
  const enough = available >= SECTION_TEST_MIN;
  const size = Math.min(SECTION_TEST_SIZE, available);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enough && !api.busy) onStart();
  }

  return (
    <Card as="section" aria-labelledby={headingId} padding="lg">
      <CardHeader titleId={headingId} title={title} />
      <div className="prose-measure mt-2 text-ink-2">{intro}</div>
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className="ui grid gap-1.5">
              <label htmlFor={field.id} className="text-sm font-semibold text-ink">
                {field.label}
              </label>
              <select
                id={field.id}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                aria-describedby={countId}
                className="min-h-11 w-full rounded-control border border-rule-strong bg-surface px-3 text-base text-ink"
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <p id={countId} className="ui m-0 text-sm text-ink-2" aria-live="polite">
          {enough
            ? `${sectionName}: ${size} questions, timed from how long each one usually takes.`
            : `${sectionName} has ${available} question${available === 1 ? '' : 's'} so far, and a section test needs at least ${SECTION_TEST_MIN}. Pick another, or practise from the bank.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={!enough || api.busy}>
            Start the section test
          </Button>
          {!enough ? (
            <ButtonLink href={bankHref} variant="secondary">
              Go to the question bank
            </ButtonLink>
          ) : null}
        </div>
      </form>
      <BeginFeedback api={api} />
      <p className="ui mt-4 mb-0 text-xs text-ink-2">{SAVED_NOTE}</p>
    </Card>
  );
}
