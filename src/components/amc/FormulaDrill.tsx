'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Grade } from 'ts-fsrs';
import Link from '@/components/AppLink';
import { Badge, Button, ButtonLink, Card, CheckboxRow, StatTile } from '@/components/ui';
import type { AmcFormulaContest, FormulaPriority } from '@/lib/amc-schemas';
import {
  DRILL_GRADES,
  EMPTY_DRILL,
  drillCounts,
  drillQueue,
  formatInterval,
  gradeFormula,
  previewDue,
  readDrill,
  returnsThisSession,
  writeDrill,
  type DrillFile,
} from '@/lib/formula-drill';
import { filterFormulas } from '@/lib/formula-sheet';

export interface DrillCard {
  id: string;
  name: string;
  areaName: string;
  priority: FormulaPriority;
  contests: AmcFormulaContest[];
  /** Front: when to use it. Rendered on the server, KaTeX included. */
  front: ReactNode;
  /** Back: the formula and the worked example. Rendered on the server. */
  back: ReactNode;
}

/** New cards introduced per sitting, so a first visit is a sitting and not all of them. */
export const NEW_PER_SITTING = 10;

type Phase = 'start' | 'session' | 'done';

/**
 * The formula flashcards (docs/06 §5). Front: the formula's name and when to use it. Back: the
 * formula and a worked example. The student grades their own recall Again / Hard / Good /
 * Easy, and ts-fsrs schedules the card (src/lib/formula-drill.ts), stored in localStorage
 * under `ka-amc-formulas`.
 *
 * The grade buttons are neutral on purpose: a self-grade is not the site judging an answer,
 * so the reserved green, red and amber never appear here.
 *
 * Keyboard: Space shows or hides the formula and 1-4 grade, but only when focus is not on a
 * control that already uses those keys (a focused button keeps its own Space; a text field
 * keeps its digits). Nothing traps Tab. After a flip or a grade, focus moves to the card so
 * the next key lands somewhere sensible.
 */
export function FormulaDrill({ cards }: { cards: DrillCard[] }) {
  const [file, setFile] = useState<DrillFile>(EMPTY_DRILL);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [mustOnly, setMustOnly] = useState(false);
  const [phase, setPhase] = useState<Phase>('start');
  const [queue, setQueue] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [stored, setStored] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLHeadingElement>(null);

  // Storage and the clock are read after mount, so the server HTML and the first client
  // render agree (an empty deck, nothing due yet).
  useEffect(() => {
    setFile(readDrill());
    setNow(new Date());
    setLoaded(true);
  }, []);

  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const deck = useMemo(() => filterFormulas(cards, { mustOnly }), [cards, mustOnly]);
  const deckIds = useMemo(() => deck.map((card) => card.id), [deck]);
  const counts = now
    ? drillCounts(file, deckIds, now)
    : { due: 0, fresh: deckIds.length, later: 0 };
  const todayQueue = now ? drillQueue(file, deckIds, now, NEW_PER_SITTING) : [];
  const newToday = Math.min(counts.fresh, NEW_PER_SITTING);
  const currentId = phase === 'session' ? queue[0] : undefined;
  const current = currentId ? byId.get(currentId) : undefined;
  const preview = current && now ? previewDue(file, current.id, now) : null;

  const focusCard = useCallback(() => {
    // After React commits the new card.
    window.requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: false }));
  }, []);

  const start = () => {
    const at = new Date();
    const ids = drillQueue(file, deckIds, at, NEW_PER_SITTING);
    if (ids.length === 0) return;
    setNow(at);
    setQueue(ids);
    setFlipped(false);
    setReviewed(0);
    setPhase('session');
    setAnnouncement(`Card 1 of ${ids.length}: ${byId.get(ids[0] ?? '')?.name ?? ''}`);
    focusCard();
  };

  const flip = useCallback(() => {
    setAnnouncement(flipped ? 'Formula hidden' : 'Formula shown. Grade your recall from 1 to 4.');
    setFlipped(!flipped);
    focusCard();
  }, [flipped, focusCard]);

  const grade = useCallback(
    (value: Grade) => {
      if (!currentId) return;
      const at = new Date();
      const next = gradeFormula(file, currentId, value, at);
      setFile(next);
      setStored(writeDrill(next));
      setNow(at);
      setReviewed((count) => count + 1);
      const rest = queue.slice(1);
      const again = returnsThisSession(next, currentId, at) ? [...rest, currentId] : rest;
      setQueue(again);
      setFlipped(false);
      if (again.length === 0) {
        setPhase('done');
        setAnnouncement('Sitting finished.');
        window.requestAnimationFrame(() => startRef.current?.focus());
      } else {
        setAnnouncement(`Next card: ${byId.get(again[0] ?? '')?.name ?? ''}`);
        focusCard();
      }
    },
    [byId, currentId, file, focusCard, queue],
  );

  useEffect(() => {
    if (phase !== 'session') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ' || event.key === 'Spacebar') {
        // A focused button, link or summary already does something with Space.
        if (target?.closest('button, a, summary')) return;
        event.preventDefault();
        flip();
        return;
      }
      if (!flipped) return;
      const match = DRILL_GRADES.find((entry) => entry.key === event.key);
      if (match) {
        event.preventDefault();
        grade(match.grade);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, flipped, flip, grade]);

  const live = (
    <p className="visually-hidden" aria-live="polite" role="status">
      {announcement}
    </p>
  );

  if (phase === 'session' && current) {
    const position = reviewed + 1;
    return (
      <div className="mx-auto grid max-w-[44rem] gap-4">
        {live}
        <div className="ui flex flex-wrap items-center justify-between gap-3 text-xs text-ink-2">
          <p className="m-0 tabular-nums">
            Card {position}, {queue.length} left in this sitting
          </p>
          <Button size="sm" variant="ghost" onClick={() => setPhase('done')}>
            End sitting
          </Button>
        </div>

        <Card padding="none">
          <div
            ref={cardRef}
            tabIndex={-1}
            aria-labelledby="drill-card-name"
            role="group"
            aria-roledescription="flashcard"
            className="rounded-card p-5 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:p-6"
          >
            <div className="flex flex-wrap gap-1.5">
              <Badge>{current.areaName}</Badge>
              <Badge tone={current.priority === 'must-know' ? 'accent' : 'neutral'}>
                {current.priority === 'must-know' ? 'Must-know' : 'Good to know'}
              </Badge>
            </div>
            <h2 id="drill-card-name" className="m-0 mt-3 text-xl sm:text-2xl">
              {current.name}
            </h2>
            <div className="mt-3 text-base text-ink">
              <span className="ui text-xs font-semibold text-ink-2">When to use it</span>
              <div className="mt-1">{current.front}</div>
            </div>

            {flipped ? (
              <div className="mt-5 border-t border-rule pt-5">{current.back}</div>
            ) : (
              <p className="ui m-0 mt-5 border-t border-rule pt-5 text-sm text-ink-2">
                Say or write the formula, then check yourself.
              </p>
            )}
          </div>

          <div className="no-print border-t border-rule px-5 py-4 sm:px-6">
            {flipped ? (
              <div>
                <p id="drill-grade-label" className="ui m-0 mb-2 text-xs font-semibold text-ink-2">
                  How well did you remember it?
                </p>
                <div
                  role="group"
                  aria-labelledby="drill-grade-label"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                >
                  {DRILL_GRADES.map((entry) => (
                    <Button
                      key={entry.grade}
                      onClick={() => grade(entry.grade)}
                      aria-keyshortcuts={entry.key}
                      className="flex-col py-1.5 text-center"
                    >
                      <span className="font-semibold">
                        <span aria-hidden="true" className="mono mr-1.5 text-2xs text-ink-3">
                          {entry.key}
                        </span>
                        {entry.label}
                      </span>
                      {preview && now ? (
                        <span className="block text-2xs font-normal text-ink-3">
                          <span className="visually-hidden">, next in </span>
                          {formatInterval(now, preview[entry.grade])}
                        </span>
                      ) : null}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="mt-2" onClick={flip}>
                  Hide the formula
                </Button>
              </div>
            ) : (
              <Button variant="primary" fullWidth onClick={flip} aria-keyshortcuts="Space">
                Show the formula
              </Button>
            )}
          </div>
        </Card>

        <p className="ui m-0 text-xs text-ink-3">
          Shortcuts: Space shows or hides the formula, 1 to 4 grade it. Grading is for your own
          memory, not a mark.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {live}
      {phase === 'done' ? (
        <Card padding="lg" className="grid gap-2">
          <h2 ref={startRef} tabIndex={-1} className="m-0 text-xl focus:outline-none">
            Sitting finished
          </h2>
          <p className="m-0 text-ink-2">
            You went through {reviewed} {reviewed === 1 ? 'card' : 'cards'}. Each one is scheduled
            to come back just before you would be likely to forget it.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Due today"
          value={loaded ? todayQueue.length : '...'}
          detail={
            loaded
              ? `${counts.due} ${counts.due === 1 ? 'review' : 'reviews'}, ${newToday} new`
              : 'Reading your deck'
          }
        />
        <StatTile
          label="Not started"
          value={loaded ? counts.fresh : '...'}
          detail={`Up to ${NEW_PER_SITTING} new cards a sitting`}
        />
        <StatTile
          label="Scheduled later"
          value={loaded ? counts.later : '...'}
          detail="Learned, not due today"
        />
      </div>

      <Card padding="lg" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CheckboxRow
            label="Must-know only"
            description="Drill just the formulas marked must-know."
            checked={mustOnly}
            onCheckedChange={setMustOnly}
          />
          {todayQueue.length > 0 ? (
            <Button variant="primary" size="lg" onClick={start} disabled={!loaded}>
              {phase === 'done' ? 'Keep going' : 'Start'} ({todayQueue.length}{' '}
              {todayQueue.length === 1 ? 'card' : 'cards'})
            </Button>
          ) : (
            <Button variant="primary" size="lg" disabled>
              Nothing due
            </Button>
          )}
        </div>
        {loaded && todayQueue.length === 0 ? (
          <p className="ui m-0 text-sm text-ink-2">
            You are caught up for today. Come back tomorrow, or read the{' '}
            <Link href="/amc/formulas">formula sheet</Link> in the meantime.
          </p>
        ) : null}
        {!stored ? (
          <p className="ui m-0 text-sm text-ink-2" role="note">
            This browser is not keeping data for this site, so the schedule will not be remembered
            after you leave.
          </p>
        ) : null}
        <p className="ui m-0 text-xs text-ink-3">
          Your schedule is kept in this browser only. It is never sent anywhere.
        </p>
      </Card>

      <div>
        <ButtonLink href="/amc/formulas" variant="secondary">
          Back to the formula sheet
        </ButtonLink>
      </div>
    </div>
  );
}
