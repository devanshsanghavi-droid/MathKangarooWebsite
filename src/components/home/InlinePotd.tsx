'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import Link from '@/components/AppLink';
import { ChoiceList } from '@/components/ChoiceList';
import { FeedbackPanel } from '@/components/FeedbackPanel';
import { HintLadder } from '@/components/HintLadder';
import { DifficultyPill } from '@/components/DifficultyPill';
import { RichText } from '@/components/math/RichText';
import { Card } from '@/components/ui';
import { dayNumber, formatDay } from '@/lib/potd';
import { recordPracticeAttempt } from '@/lib/practice-record';
import type { KaPracticeItem } from '@/lib/practice-item';
import type { ChoiceKey } from '@/lib/schemas';

/** One day's puzzle: the practice item plus its primary skill's name for the meta line. */
export interface PotdPick {
  item: KaPracticeItem;
  skillName: string | null;
}

const noop = () => () => {};

/**
 * Puzzle of the day, answerable right on the home page (docs/08 item 5).
 *
 * The pick works as before: the server sends a short window of picks starting at the build
 * day, renders the build day's one so hydration matches, and the client moves to today. Each
 * pick is a full practice item, so the five choices, the misconception behind every wrong one,
 * the hints and the worked solution are all here without a fetch.
 *
 * Answering follows <ProblemInteractive>: a click is an answer, the student may change it, and
 * only the FIRST pick is recorded (through recordPracticeAttempt, like every practice surface),
 * so clicking through to the right letter after feedback can never count as a correct attempt.
 * Feedback reuses the shared <ChoiceList> and <FeedbackPanel>, which own the feedback colours,
 * and the hint ladder opens below a wrong answer as the panel promises.
 */
export function InlinePotd({
  picks,
  startDay,
  headingLevel = 2,
  onAttempt,
  className,
}: {
  /** picks[i] is the puzzle for day `startDay + i`. */
  picks: readonly PotdPick[];
  startDay: number;
  headingLevel?: 2 | 3;
  /** Called once, after the first answer is recorded. */
  onAttempt?: () => void;
  className?: string;
}) {
  const day = useSyncExternalStore(
    noop,
    () => dayNumber(new Date()),
    () => startDay,
  );
  if (picks.length === 0) return null;
  const offset = (((day - startDay) % picks.length) + picks.length) % picks.length;
  const pick = picks[offset];
  if (!pick) return null;
  return (
    <PotdCard
      key={pick.item.id}
      pick={pick}
      day={day}
      headingLevel={headingLevel}
      onAttempt={onAttempt}
      className={className}
    />
  );
}

function PotdCard({
  pick: { item, skillName },
  day,
  headingLevel,
  onAttempt,
  className,
}: {
  pick: PotdPick;
  day: number;
  headingLevel: 2 | 3;
  onAttempt?: () => void;
  className?: string;
}) {
  const [selected, setSelected] = useState<ChoiceKey | null>(null);
  const recorded = useRef(false);
  const Heading = `h${headingLevel}` as 'h2' | 'h3';

  const correctKey = item.choices.find((choice) => choice.correct)?.key ?? null;
  const answeredCorrectly = selected !== null && selected === correctKey;

  const onSelect = (key: ChoiceKey): void => {
    setSelected(key);
    if (recorded.current) return;
    recorded.current = true;
    recordPracticeAttempt(item, {
      choiceKey: key,
      correct: key === correctKey,
      // Hints only open after a wrong answer, so the recorded first pick never had one.
      hintsUsed: 0,
      surface: 'home',
      mode: 'practice',
    });
    onAttempt?.();
  };

  return (
    <Card as="section" aria-labelledby="potd-heading" padding="lg" className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Heading id="potd-heading" className="ui m-0 text-base font-semibold text-ink">
          Puzzle of the day
        </Heading>
        <p className="ui m-0 text-xs text-ink-3">{formatDay(new Date(day * 86_400_000))}</p>
      </div>
      <p className="ui mt-3 mb-0 flex flex-wrap items-center gap-2 text-xs text-ink-2">
        <DifficultyPill points={item.points} />
        <span className="mono rounded-pill border border-rule px-2 py-0.5 text-2xs">
          {item.levelLabel}
        </span>
        {skillName ? <span>{skillName}</span> : null}
      </p>
      <p className="statement mt-3 mb-4 text-ink">
        <RichText text={item.statement} math={item.math} />
      </p>
      <ChoiceList
        choices={item.choices}
        selected={selected}
        onSelect={onSelect}
        revealAnswer={answeredCorrectly}
        idPrefix={`potd-${item.id}`}
        math={item.math}
      />
      <FeedbackPanel problem={item} selectedKey={selected} math={item.math} />
      {selected !== null && !answeredCorrectly ? (
        <div className="mt-4">
          <HintLadder problemId={item.id} hints={item.hints} math={item.math} />
        </div>
      ) : null}
      <p className="ui mt-4 mb-0 flex flex-wrap items-baseline justify-between gap-2 text-2xs text-ink-3">
        <span>A new puzzle every day, the same one for everyone.</span>
        <Link href={item.href} className="text-xs">
          Open on its own page
          <span className="visually-hidden"> (puzzle of the day, {item.id})</span>
        </Link>
      </p>
    </Card>
  );
}
