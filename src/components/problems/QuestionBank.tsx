'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgress } from '@/components/mastery/useProgress';
import { Button, ButtonLink, Card, ProgressBar, Sheet } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import {
  dataPaths,
  type AmcIndexFile,
  type KaIndexFile,
  type TestIndexFile,
} from '@/lib/bank-data';
import { fetchStaticJson } from '@/lib/bank-client';
import {
  BANK_PAGE_SIZE,
  BANK_QUERY_MAX,
  EMPTY_FILTERS,
  bankFiltersToSearch,
  bankRowsFromIndex,
  countBy,
  filterRows,
  idsIn,
  isFiltered,
  missedSet,
  parseBankFilters,
  practiceIds,
  randomUnsolved,
  rowsIgnoringStatus,
  savedSet,
  searchText,
  statusMap,
  taxonomyGroupNames,
  type BankFilters,
  type BankMarks,
  type BankRow,
  type BankTaxonomy,
} from '@/lib/bank-filter';
import { PRACTICE_SET_MAX, practiceSetHref, type PracticeBank } from '@/lib/practice-item';
import { BankFilterPanel } from './BankFilterPanel';
import { BankList, BankPagination } from './BankList';
import { StatusLegend } from './StatusGlyph';

/** Each bank's static index in public/data/ (bank-data.ts). */
const INDEX_URL: Readonly<Record<PracticeBank, string>> = {
  ka: dataPaths.kaIndex,
  amc: dataPaths.amcIndex,
  sat: dataPaths.satIndex,
  act: dataPaths.actIndex,
};

export interface QuestionBankProps {
  /** Built at build time on the server: ka-, amc- or testBankTaxonomy(...). */
  taxonomy: BankTaxonomy;
  /**
   * The first page of rows, server-rendered so the prerendered HTML lists real problems for a
   * crawler and for a reader whose JavaScript never arrives. Same shape as the full index.
   */
  initialRows: BankRow[];
  /** Problems in the whole bank, shown until the index has loaded. */
  total: number;
  /** The static index to fetch. Defaults to the bank's file in public/data/. */
  indexUrl?: string;
  /** Heading id for the list, so the page can label it. */
  listHeading?: string;
}

/**
 * The question bank (docs/06 §4): a sticky filter column on the left (a "Filters" sheet on a
 * phone), and on the right a header card with the count, a progress bar for the selection,
 * Start practice and Random unsolved, then the compact list, 50 to a page.
 *
 * Fully client-side over the static index (docs/06 §3). The filter state lives in React and is
 * mirrored into the URL with history.replaceState, so a selection is shareable and survives a
 * reload, but no filter is ever a link and no filtered view is ever rendered by a worker. The
 * URL is read after mount, so the server HTML is always the unfiltered first page.
 *
 * Generic over the bank: the AMC bank passes `amcBankTaxonomy(...)` and AMC rows, and gets
 * contests instead of levels, areas and topics instead of strands and skills, problem-type
 * chips, and Early / Middle / Late tiers. The SAT and ACT banks pass `testBankTaxonomy(...)`:
 * no level control, domains and skills, Easy / Medium / Hard.
 *
 * docs/08 items 10-11: a keyword search box (statement preview, skill / topic and type names,
 * id; every word must match), Saved and Missed in the status filter, and "Practice missed" /
 * "Practice saved", which start a set of those questions within the current selection (every
 * filter but status applies), up to PRACTICE_SET_MAX.
 */
export function QuestionBank({
  taxonomy,
  initialRows,
  total,
  indexUrl,
  listHeading = 'bank-list-heading',
}: QuestionBankProps) {
  const [rows, setRows] = useState<BankRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<BankFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [message, setMessage] = useState('');
  const urlRead = useRef(false);
  const listTop = useRef<HTMLDivElement>(null);
  const file = useProgress();
  const url = indexUrl ?? INDEX_URL[taxonomy.bank];

  // Read the shared selection out of the URL once, after hydration.
  useEffect(() => {
    setFilters(parseBankFilters(window.location.search, taxonomy));
    urlRead.current = true;
  }, [taxonomy]);

  // Mirror the selection back. replaceState, not pushState: ticking ten boxes should not leave
  // ten entries for the Back button to walk through.
  useEffect(() => {
    if (!urlRead.current) return;
    const search = bankFiltersToSearch(filters, taxonomy);
    if (search === window.location.search) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}`);
  }, [filters, taxonomy]);

  useEffect(() => {
    let cancelled = false;
    fetchStaticJson<KaIndexFile | AmcIndexFile | TestIndexFile>(url)
      .then((index) => {
        if (!cancelled) setRows(bankRowsFromIndex(taxonomy, index));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [taxonomy, url]);

  const allRows = rows ?? initialRows;
  const loaded = rows !== null;
  const statuses = useMemo(
    () => statusMap(taxonomy.bank, file, allRows),
    [taxonomy.bank, file, allRows],
  );
  const names = useMemo(() => {
    const map = taxonomyGroupNames(taxonomy);
    for (const tag of taxonomy.tags?.items ?? []) map.set(tag.id, tag.name);
    return map;
  }, [taxonomy]);
  const text = useMemo(
    () => new Map(allRows.map((row) => [row.id, searchText(row, names)])),
    [allRows, names],
  );
  const marks = useMemo<BankMarks>(
    () => ({
      saved: savedSet(file),
      missed: missedSet(taxonomy.bank, file, allRows),
      text,
    }),
    [file, taxonomy.bank, allRows, text],
  );
  const filtered = useMemo(
    () => filterRows(allRows, filters, statuses, marks),
    [allRows, filters, statuses, marks],
  );
  const pool = useMemo(
    () => rowsIgnoringStatus(allRows, filters, statuses, marks),
    [allRows, filters, statuses, marks],
  );
  const missedIds = idsIn(pool, marks.missed ?? new Set(), PRACTICE_SET_MAX);
  const savedPracticeIds = idsIn(pool, marks.saved ?? new Set(), PRACTICE_SET_MAX);
  const selectionTotal = loaded ? filtered.length : total;
  const tally = countBy(filtered, statuses);
  const pageCount = Math.max(1, Math.ceil(filtered.length / BANK_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const start = (page - 1) * BANK_PAGE_SIZE;
  const pageRows = filtered.slice(start, start + BANK_PAGE_SIZE);
  const setIds = practiceIds(filtered, statuses, PRACTICE_SET_MAX);
  // Until the index arrives only the first page is known, so a filtered view would lie.
  const waiting = !loaded && isFiltered(filters);

  const update = useCallback((next: BankFilters) => {
    setMessage('');
    setFilters(next);
  }, []);

  const goToPage = (next: number) => {
    setFilters((current) => ({ ...current, page: next }));
    listTop.current?.scrollIntoView?.({ block: 'start' });
    listTop.current?.focus({ preventScroll: true });
  };

  const pickRandom = () => {
    const row = randomUnsolved(filtered, statuses);
    if (!row) {
      setMessage(`You have solved every ${taxonomy.noun} in this selection. Widen it for more.`);
      return;
    }
    window.location.assign(row.href);
  };

  const activeCount =
    (filters.level !== 'all' ? 1 : 0) +
    filters.groups.length +
    filters.tags.length +
    filters.points.length +
    filters.status.length +
    (filters.figure ? 1 : 0);

  const panel = (idPrefix: string, showHeading: boolean) => (
    <BankFilterPanel
      showHeading={showHeading}
      taxonomy={taxonomy}
      filters={filters}
      onChange={update}
      rows={allRows}
      statuses={statuses}
      idPrefix={idPrefix}
      pending={!loaded}
      marks={marks}
    />
  );

  return (
    <div
      data-bank-loaded={loaded || undefined}
      className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start"
    >
      <aside
        aria-label="Filters"
        className="no-print hidden lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:block lg:max-h-[calc(100dvh-var(--header-height)-2rem)] lg:overflow-y-auto"
      >
        <Card padding="md">{panel('bank-desktop', true)}</Card>
      </aside>

      <div className="grid min-w-0 gap-4">
        <Card padding="lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="ui min-w-0">
              <p className="m-0 text-xs font-semibold text-ink-2">
                {isFiltered(filters) ? 'Selected' : 'Whole bank'}
              </p>
              <p
                className="m-0 mt-1 text-3xl font-semibold text-ink tabular-nums"
                aria-live="polite"
              >
                {waiting ? '...' : selectionTotal}
                <span className="ml-2 text-base font-normal text-ink-2">
                  {selectionTotal === 1 ? taxonomy.noun : `${taxonomy.noun}s`}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="lg:hidden"
                onClick={() => setSheetOpen(true)}
                aria-haspopup="dialog"
              >
                Filters{activeCount > 0 ? ` (${activeCount})` : ''}
              </Button>
              <Button onClick={pickRandom} disabled={!loaded || filtered.length === 0}>
                Random unsolved
              </Button>
              {setIds.length > 0 && loaded ? (
                <ButtonLink
                  variant="primary"
                  href={practiceSetHref({ bank: taxonomy.bank, ids: setIds })}
                >
                  Start practice ({setIds.length})
                </ButtonLink>
              ) : (
                <Button variant="primary" disabled>
                  Start practice
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="ui grid min-w-0 flex-1 basis-56 gap-1">
              <label htmlFor="bank-search" className="text-xs font-semibold text-ink-2">
                Search {taxonomy.noun}s
              </label>
              <input
                id="bank-search"
                type="search"
                value={filters.query}
                maxLength={BANK_QUERY_MAX}
                autoComplete="off"
                spellCheck={false}
                placeholder="Words from the question, or a skill"
                onChange={(event) => update({ ...filters, query: event.target.value, page: 1 })}
                className="tap-target w-full min-w-0 rounded-md border-2 border-rule-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3 focus-visible:border-accent-600"
              />
            </div>
            <QuickPracticeLink
              label="Practice missed"
              ids={missedIds}
              bank={taxonomy.bank}
              ready={loaded}
            />
            <QuickPracticeLink
              label="Practice saved"
              ids={savedPracticeIds}
              bank={taxonomy.bank}
              ready={loaded}
            />
          </div>
          <ProgressBar
            className="mt-4"
            value={tally.solved}
            max={tally.total}
            label={isFiltered(filters) ? 'Solved in this selection' : 'Solved in the bank'}
          />
          <p className="ui m-0 mt-3 text-xs text-ink-3" aria-live="polite">
            {message ||
              (filtered.length > PRACTICE_SET_MAX
                ? `A set is up to ${PRACTICE_SET_MAX} questions, unsolved ones first.`
                : null)}
            {loadError
              ? ' The full bank could not be loaded, so only the first page is shown. Reload to try again.'
              : null}
          </p>
        </Card>

        <Card padding="none">
          <div
            ref={listTop}
            tabIndex={-1}
            className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3 px-4 py-3 focus:outline-none"
          >
            <h2 id={listHeading} className="ui m-0 text-base font-semibold text-ink">
              Questions
            </h2>
            <StatusLegend />
          </div>
          {waiting ? (
            <p className="m-0 border-t border-rule px-4 py-6 text-sm text-ink-2" role="status">
              Loading the bank...
            </p>
          ) : pageRows.length === 0 ? (
            <div className="border-t border-rule p-4">
              <EmptyState
                action={
                  <Button size="sm" onClick={() => update(EMPTY_FILTERS)}>
                    Clear all filters
                  </Button>
                }
              >
                No {taxonomy.noun} matches these filters. There are {allRows.length} in the bank
                altogether.
              </EmptyState>
            </div>
          ) : (
            <div className="border-t border-rule">
              <BankList rows={pageRows} statuses={statuses} labelledBy={listHeading} />
            </div>
          )}
          {loaded ? (
            <BankPagination
              className="border-t border-rule px-4 py-3"
              page={page}
              pageCount={pageCount}
              from={filtered.length === 0 ? 0 : start + 1}
              to={Math.min(start + BANK_PAGE_SIZE, filtered.length)}
              total={filtered.length}
              onPage={goToPage}
            />
          ) : null}
        </Card>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        closeLabel="Done"
        footer={
          <Button variant="primary" fullWidth onClick={() => setSheetOpen(false)}>
            Show {filtered.length} {filtered.length === 1 ? taxonomy.noun : `${taxonomy.noun}s`}
          </Button>
        }
      >
        {panel('bank-sheet', false)}
      </Sheet>
    </div>
  );
}

/**
 * "Practice missed (3)" / "Practice saved (5)": a link to a set of exactly those ids, or a
 * disabled button saying there are none yet (and while the index is still loading).
 */
function QuickPracticeLink({
  label,
  ids,
  bank,
  ready,
}: {
  label: string;
  ids: readonly string[];
  bank: PracticeBank;
  ready: boolean;
}) {
  if (!ready || ids.length === 0) {
    return (
      <Button disabled>
        {label}
        {ready ? ' (0)' : ''}
      </Button>
    );
  }
  return (
    <ButtonLink href={practiceSetHref({ bank, ids, name: label })}>
      {label} ({ids.length})
    </ButtonLink>
  );
}
