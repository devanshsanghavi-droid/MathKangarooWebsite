'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { FigureRenderer } from '@/components/FigureRenderer';
import { Button } from '@/components/ui';
import { fetchStaticJson, loadPracticeItems } from '@/lib/bank-client';
import { dataPaths, type KaIndexFile, type KaIndexRow } from '@/lib/bank-data';
import type { PracticeItem } from '@/lib/practice-item';
import { SITE } from '@/lib/site';
import { track } from '@/lib/telemetry/client';
import {
  DEFAULT_WORKSHEET,
  parseWorksheetQuery,
  selectProblems,
  toSearchParams,
  type WorksheetQuery,
} from '@/lib/worksheet';
import { WorksheetControls } from './WorksheetControls';

/**
 * `/print` in the browser: the controls, the worksheet and its answer key.
 *
 * Static (docs/06 §3). The selection runs over `public/data/ka-index.json` with the same seeded
 * `selectProblems` as before, and the chosen problems are fetched from `public/data/p/<id>.json`.
 * The query is read from the URL after mount and mirrored back with replaceState, so a URL is
 * still a sheet: the same link prints the same questions and the same key, for ever.
 *
 * The server renders the default sheet (10 questions, seed 1) into the HTML, so the page works
 * as a printable sheet even before, or without, JavaScript.
 *
 * The answer key is the part that does not exist anywhere else: for every wrong choice it gives
 * the misconception that produces it, so a tutor marking a stack of sheets can see what a
 * student was thinking rather than only that they were wrong.
 */
export function WorksheetBuilder({
  initialItems,
  initialAvailable,
  total,
}: {
  /** The default sheet, rendered at build time. */
  initialItems: PracticeItem[];
  initialAvailable: number;
  /** Problems in the bank. */
  total: number;
}) {
  const [query, setQuery] = useState<WorksheetQuery>(DEFAULT_WORKSHEET);
  const [rows, setRows] = useState<KaIndexRow[] | null>(null);
  const [items, setItems] = useState<PracticeItem[]>(initialItems);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState(false);
  const urlRead = useRef(false);

  useEffect(() => {
    // Repeated keys (`?skill=A&skill=B`) are how the query serialises, so keep every value.
    const raw: Record<string, string[]> = {};
    for (const [key, value] of new URLSearchParams(window.location.search)) {
      (raw[key] ??= []).push(value);
    }
    setQuery(parseWorksheetQuery(raw));
    urlRead.current = true;
  }, []);

  useEffect(() => {
    if (!urlRead.current) return;
    const params = toSearchParams(query).toString();
    const search = params ? `?${params}` : '';
    if (search === window.location.search) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    fetchStaticJson<KaIndexFile>(dataPaths.kaIndex)
      .then((index) => {
        if (!cancelled) setRows(index.rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selection = useMemo(() => {
    if (rows) {
      const { selected, available } = selectProblems(rows, query);
      return { ids: selected.map((row) => row.id), available };
    }
    return null;
  }, [rows, query]);
  const idsKey = selection?.ids.join(',') ?? null;

  useEffect(() => {
    if (idsKey === null) return;
    const ids = idsKey ? idsKey.split(',') : [];
    let cancelled = false;
    setLoadingItems(true);
    loadPracticeItems(ids)
      .then(({ items: loaded }) => {
        if (cancelled) return;
        setItems(loaded);
        setLoadingItems(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const available = selection?.available ?? initialAvailable;
  const title = query.title || 'Math Kangaroo practice';
  const empty = selection !== null && selection.ids.length === 0;

  return (
    <>
      <WorksheetControls
        query={query}
        onChange={setQuery}
        available={available}
        selected={empty ? 0 : items.length}
        loading={loadingItems}
        onPrint={() => {
          track('worksheet_print', { surface: 'worksheet' });
          window.print();
        }}
      />

      {error ? (
        <p className="no-print mt-4 mb-0 text-sm text-ink-2" role="status">
          The problem bank could not be loaded, so the default sheet is shown. Reload to try again.
        </p>
      ) : null}

      {empty ? (
        <div className="no-print mt-6">
          <EmptyState
            action={
              <Button size="sm" onClick={() => setQuery(DEFAULT_WORKSHEET)}>
                Start over
              </Button>
            }
          >
            No problem matches these filters. There are {total} problems in the bank altogether.
          </EmptyState>
        </div>
      ) : (
        <div aria-busy={loadingItems || undefined}>
          <Worksheet items={items} title={title} seed={query.seed} />
          <AnswerKey items={items} title={title} />
        </div>
      )}
    </>
  );
}

export function Worksheet({
  items,
  title,
  seed,
}: {
  items: readonly PracticeItem[];
  title: string;
  seed: number;
}) {
  return (
    <section aria-labelledby="worksheet-heading" className="worksheet mt-10">
      <header className="border-b border-rule pb-3">
        <h2 id="worksheet-heading" className="m-0 text-lg">
          {title}
        </h2>
        <p className="mt-1 mb-0 flex flex-wrap gap-x-4 text-xs text-ink-3">
          <span>Name: ______________________</span>
          <span>Date: ____________</span>
          <span className="mono">
            {items.length} questions · {items.reduce((n, p) => n + p.points, 0)} points
          </span>
        </p>
      </header>

      <ol className="m-0 grid list-none gap-8 p-0 pt-6">
        {items.map((item, index) => (
          <li key={item.id} className="worksheet-item">
            <p className="reading m-0 text-ink">
              <span className="mono mr-2 font-semibold">{index + 1}.</span>
              {item.statement}
              <span className="mono ml-2 text-2xs text-ink-3">[{item.points}]</span>
            </p>
            {item.figure ? <FigureRenderer figure={item.figure} problemId={item.id} /> : null}
            <ul className="m-0 mt-3 grid list-none gap-1 p-0 pl-6 sm:grid-cols-2">
              {item.choices.map((choice) => (
                <li key={choice.key} className="reading text-sm text-ink">
                  <span className="mono mr-2 text-ink-3">{choice.key}</span>
                  {choice.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mono mt-8 border-t border-rule pt-3 text-2xs text-ink-3">
        {SITE.name} · {SITE.url} · seed {seed} · CC BY-NC-SA 4.0 · Independent project, not
        affiliated with Math Kangaroo in USA, NFP.
      </p>
    </section>
  );
}

export function AnswerKey({ items, title }: { items: readonly PracticeItem[]; title: string }) {
  return (
    <section aria-labelledby="key-heading" className="answer-key mt-16">
      <header className="border-b border-rule pb-3">
        <h2 id="key-heading" className="m-0 text-lg">
          Answer key - {title}
        </h2>
        <p className="mt-1 mb-0 text-xs text-ink-3">
          Each wrong choice carries the thinking that produces it. When a student picks C, this is
          what they were doing.
        </p>
      </header>

      <ol className="m-0 grid list-none gap-6 p-0 pt-6">
        {items.map((item, index) => {
          const correct = item.choices.find((choice) => choice.correct);
          const skill = item.groups[0];
          return (
            <li key={item.id} className="worksheet-item">
              <p className="m-0 flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="mono font-semibold text-ink">{index + 1}.</span>
                <span className="font-semibold text-ink">
                  {correct?.key} - {correct?.text}
                </span>
                <span className="mono text-2xs text-ink-3">{item.id}</span>
                {skill ? <span className="text-xs text-ink-3">{skill.name}</span> : null}
              </p>
              <ul className="m-0 mt-2 grid list-none gap-1 p-0 pl-6">
                {item.choices
                  .filter((choice) => !choice.correct)
                  .map((choice) => (
                    <li key={choice.key} className="text-sm text-ink-2">
                      <span className="mono mr-2 text-ink-3">{choice.key}</span>
                      {choice.misconception}
                    </li>
                  ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
