'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Card } from '@/components/ui';
import { loadPracticeItems } from '@/lib/bank-client';
import { saveSession } from '@/lib/local-progress';
import { recordPracticeAttempt } from '@/lib/practice-record';
import type { PracticeItem } from '@/lib/practice-item';
import type { ChoiceKey } from '@/lib/schemas';
import {
  chooseAnswer,
  clearAnswer,
  EXAM_SPECS,
  EXAM_STORAGE_PREFIX,
  goToQuestion,
  itemFacts,
  parseExamState,
  scoreExam,
  sectionTestMinutes,
  startExam,
  submitModule,
  syncClock,
  toggleFlag,
  toSessionRecord,
  type ExamId,
  type ExamModuleSpec,
  type ExamState,
  type GroupResult,
} from '@/lib/exam-engine';
import type { SessionKind } from '@/lib/local-progress';
import { ExamRunner } from './ExamRunner';
import { ExamReport } from './ExamReport';
import { toQuestionView } from './ExamQuestion';

/** What a start screen hands the session: the paper and how it is timed. */
export interface ExamPlan {
  kind: SessionKind;
  exam: ExamId;
  section?: string | null;
  title: string;
  seed: number;
  problemIds: readonly string[];
  /** Fixed modules (a mock), or 'section' to time one module from the questions' estimates. */
  modules: readonly ExamModuleSpec[] | 'section';
  labels?: Record<string, string>;
}

export type BeginExam = (plan: ExamPlan) => void;

export interface StartScreenApi {
  begin: BeginExam;
  /** True while the chosen paper's questions are being fetched. */
  busy: boolean;
  /** Set when the last begin could not fetch its questions. */
  error: string | null;
}

type Phase =
  | { status: 'reading' }
  | { status: 'idle' }
  | { status: 'loading'; state: ExamState | null }
  | { status: 'ready'; state: ExamState; items: ReadonlyMap<string, PracticeItem> }
  | { status: 'failed'; state: ExamState };

function readSaved(key: string): ExamState | null {
  try {
    return parseExamState(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeSaved(key: string, state: ExamState | null): void {
  try {
    if (state) window.localStorage.setItem(key, JSON.stringify(state));
    else window.localStorage.removeItem(key);
  } catch {
    // Losing resumability is not a reason to stop the exam.
  }
}

async function fetchItems(ids: readonly string[]): Promise<Map<string, PracticeItem>> {
  const { items, missing } = await loadPracticeItems(ids);
  if (missing.length > 0) throw new Error(`missing ${missing.join(', ')}`);
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * One timed sitting from start screen to report, for any exam (docs/07 section 4).
 *
 *   start    the route's own start screen (contest, level, section pickers), given `begin`
 *   run      ExamRunner, with the clock ticking here and every rule in exam-engine.ts
 *   report   ExamReport, scored from the question files fetched at the start
 *
 * The run is saved to localStorage under `ka-exam:<slot>` after every change, so a refresh
 * comes back to the same paper, the same answers and the clock where it should be. Questions
 * are fetched from /data/p/<id>.json; the runner only ever sees the statement and choices.
 *
 * When the sitting ends, every answered question is recorded as an ordinary attempt through
 * the bank's own recorder, and the session through `saveSession`, exactly once (the saved
 * state carries `recorded`, so a refresh on the report does not count it twice).
 */
export function ExamSession({
  slot,
  renderStart,
  renderActions,
  focusHref,
}: {
  /** Storage slot, one per route: "amc-mock", "sat-section". */
  slot: string;
  renderStart: (api: StartScreenApi) => ReactNode;
  /** Buttons under the report; `again` discards the finished run and shows the start screen. */
  renderActions: (state: ExamState, again: () => void) => ReactNode;
  focusHref: (state: ExamState, entry: GroupResult) => string | null;
}) {
  const key = `${EXAM_STORAGE_PREFIX}${slot}`;
  const [phase, setPhase] = useState<Phase>({ status: 'reading' });
  const [startError, setStartError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const reportRef = useRef<HTMLHeadingElement>(null);
  const wasFinished = useRef(false);

  const state = phase.status === 'ready' ? phase.state : null;

  const load = useCallback((saved: ExamState) => {
    setPhase({ status: 'loading', state: saved });
    fetchItems(saved.problemIds)
      .then((items) => {
        const synced = syncClock(saved, new Date());
        wasFinished.current = synced.finishedAt !== null;
        setNow(new Date());
        setPhase({ status: 'ready', state: synced, items });
      })
      .catch(() => setPhase({ status: 'failed', state: saved }));
  }, []);

  // Resume whatever this route left in progress or finished.
  useEffect(() => {
    const saved = readSaved(key);
    if (saved) load(saved);
    else setPhase({ status: 'idle' });
  }, [key, load]);

  const update = useCallback((change: (current: ExamState) => ExamState) => {
    setPhase((current) => {
      if (current.status !== 'ready') return current;
      const next = change(current.state);
      return next === current.state ? current : { ...current, state: next };
    });
  }, []);

  useEffect(() => {
    if (state) writeSaved(key, state);
  }, [key, state]);

  // One tick a second while the clock runs; expiries are applied as they happen.
  const running = state !== null && state.finishedAt === null;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const at = new Date();
      setNow(at);
      update((current) => syncClock(current, at));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, update]);

  const items = phase.status === 'ready' ? phase.items : null;
  const views = useMemo(
    () =>
      items ? new Map([...items.values()].map((item) => [item.id, toQuestionView(item)])) : null,
    [items],
  );

  const report = useMemo(() => {
    if (!state?.finishedAt || !items) return null;
    const facts = new Map([...items.values()].map((item) => [item.id, itemFacts(item)]));
    return scoreExam(state, EXAM_SPECS[state.exam], facts);
  }, [state, items]);

  // Record the attempts and the session once, when the report first exists.
  useEffect(() => {
    if (!state || !report || !items || state.recorded) return;
    const at = state.finishedAt ? new Date(state.finishedAt) : new Date();
    for (const result of report.questions) {
      const item = items.get(result.id);
      if (!item || result.chosenKey === null) continue;
      recordPracticeAttempt(item, {
        choiceKey: result.chosenKey,
        correct: result.outcome === 'correct',
        hintsUsed: 0,
        surface: 'mock',
        at,
      });
    }
    const record = toSessionRecord(state, report);
    if (record) saveSession(record);
    update((current) => ({ ...current, recorded: true }));
  }, [state, report, items, update]);

  // Landing on the report moves focus to its heading, so it is announced.
  useEffect(() => {
    if (!state?.finishedAt || wasFinished.current) return;
    wasFinished.current = true;
    reportRef.current?.focus({ preventScroll: true });
    reportRef.current?.scrollIntoView?.({ block: 'start' });
  }, [state?.finishedAt]);

  const begin = useCallback<BeginExam>((plan) => {
    setStartError(null);
    setPhase({ status: 'loading', state: null });
    fetchItems(plan.problemIds)
      .then((fetched) => {
        const modules =
          plan.modules === 'section'
            ? [
                {
                  label: plan.title,
                  count: plan.problemIds.length,
                  minutes: sectionTestMinutes(
                    plan.problemIds.map((id) => fetched.get(id)?.estSeconds ?? 60),
                  ),
                },
              ]
            : plan.modules;
        const started = startExam({
          kind: plan.kind,
          exam: plan.exam,
          section: plan.section ?? null,
          title: plan.title,
          seed: plan.seed,
          problemIds: plan.problemIds,
          modules,
          ...(plan.labels ? { labels: plan.labels } : {}),
          now: new Date(),
        });
        wasFinished.current = false;
        setNow(new Date());
        setPhase({ status: 'ready', state: started, items: fetched });
      })
      .catch(() => {
        setStartError('The questions could not be loaded. Check your connection and try again.');
        setPhase({ status: 'idle' });
      });
  }, []);

  const again = useCallback(() => {
    writeSaved(key, null);
    wasFinished.current = false;
    setPhase({ status: 'idle' });
  }, [key]);

  if (phase.status === 'reading') return null;

  if (phase.status === 'failed') {
    return (
      <Card padding="lg">
        <h2 className="m-0 text-lg">Your test could not be reopened</h2>
        <p className="m-0 mt-2 max-w-prose text-ink-2">
          The questions for the test in progress could not be fetched. Your answers are still saved
          on this device. Check your connection and try again.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => load(phase.state)}>
            Try again
          </Button>
          <Button onClick={again}>Discard it and start over</Button>
        </div>
      </Card>
    );
  }

  if (phase.status === 'idle' || (phase.status === 'loading' && phase.state === null)) {
    return <>{renderStart({ begin, busy: phase.status === 'loading', error: startError })}</>;
  }

  if (phase.status === 'loading') {
    return (
      <Card padding="lg">
        <p className="m-0 text-ink-2" role="status">
          Loading your test...
        </p>
      </Card>
    );
  }

  const spec = EXAM_SPECS[phase.state.exam];

  if (phase.state.finishedAt && report) {
    return (
      <ExamReport
        ref={reportRef}
        state={phase.state}
        spec={spec}
        report={report}
        items={phase.items}
        focusHref={(entry) => focusHref(phase.state, entry)}
        actions={renderActions(phase.state, again)}
      />
    );
  }

  return (
    <ExamRunner
      state={phase.state}
      spec={spec}
      questions={views ?? new Map()}
      now={now}
      onChoose={(choice: ChoiceKey) => update((current) => chooseAnswer(current, choice))}
      onClear={() => update(clearAnswer)}
      onFlag={() => update(toggleFlag)}
      onGo={(index) => update((current) => goToQuestion(current, index, new Date()))}
      onSubmit={() => update((current) => submitModule(current, new Date()))}
    />
  );
}
