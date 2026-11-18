'use client';

import { forwardRef } from 'react';
import { ChoiceList } from '@/components/ChoiceList';
import { FigureRenderer } from '@/components/FigureRenderer';
import { RichText } from '@/components/math/RichText';
import { Badge, Card } from '@/components/ui';
import type { ChoiceKey, Figure } from '@/lib/schemas';
import type { PracticeItem } from '@/lib/practice-item';

/**
 * What the runner may show of a question while the clock runs: the statement, the figure and
 * the choice letters and texts. Nothing that tells right from wrong, no hints, no solution, no
 * misconception. `toQuestionView` builds a fresh object, so a whole item can never slip through
 * structural typing with its answers attached.
 */
export interface ExamQuestionView {
  id: string;
  statement: string;
  math: boolean;
  figure: Figure | null;
  choices: Array<{ key: ChoiceKey; text: string }>;
  /** "Early (slots 1-10)", "Hard", or null for Kangaroo, which shows its point value. */
  tierLabel: string | null;
  points: number;
}

export function toQuestionView(item: PracticeItem): ExamQuestionView {
  return {
    id: item.id,
    statement: item.statement,
    math: item.math,
    figure: item.figure ? { component: item.figure.component, alt: item.figure.alt } : null,
    choices: item.choices.map((choice) => ({ key: choice.key, text: choice.text })),
    tierLabel: item.tierLabel,
    points: item.points,
  };
}

export const ExamQuestion = forwardRef<
  HTMLHeadingElement,
  {
    question: ExamQuestionView;
    /** "Question 4" or "Module 2, question 4". */
    heading: string;
    chosenKey: ChoiceKey | null;
    onChoose: (key: ChoiceKey) => void;
  }
>(function ExamQuestion({ question, heading, chosenKey, onChoose }, ref) {
  const headingId = `exam-question-${question.id}`;
  return (
    <Card as="article" aria-labelledby={headingId} padding="lg">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id={headingId}
          ref={ref}
          tabIndex={-1}
          className="ui m-0 text-sm font-semibold text-ink focus:outline-none"
        >
          {heading}
        </h2>
        <Badge tone="outline">{question.tierLabel ?? `${question.points} pt`}</Badge>
      </div>

      <p className="statement prose-measure mt-4 mb-0 text-ink">
        <RichText text={question.statement} math={question.math} />
      </p>

      {question.figure ? <FigureRenderer figure={question.figure} problemId={question.id} /> : null}

      <div className="mt-5">
        <ChoiceList
          key={question.id}
          /*
            ChoiceList reads `correct` only to draw a judged answer. It is false for every
            choice here and `pending` is on, so a pick is always drawn as a neutral selection:
            the runner has no way to show right or wrong because it does not know.
          */
          choices={question.choices.map((choice) => ({ ...choice, correct: false }))}
          selected={chosenKey}
          onSelect={onChoose}
          pending
          idPrefix={`exam-choice-${question.id}`}
          math={question.math}
        />
      </div>
    </Card>
  );
});
