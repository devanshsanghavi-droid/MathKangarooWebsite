import Link from '@/components/AppLink';
import { ButtonLink, cx } from '@/components/ui';
import { sectionTestHref } from '@/lib/exam-engine';
import type { Exam, ExamColorToken, ExamFormat, ExamScoring } from '@/lib/exams';

/**
 * Small hook-free pieces of the exam pages and the catalog (docs/08 items 2 and 3), usable
 * from server pages and from the Kangaroo level picker alike. Colour comes only from the
 * exam's token classes in exams.ts, and the exam's name is always printed beside it, so the
 * colour is never the only carrier.
 */

/** The exam's short name on a solid pill in its colour. */
export function ExamChip({ exam, className }: { exam: Exam; className?: string }) {
  return (
    <span
      className={cx(
        'ui inline-flex shrink-0 items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        exam.classes.fill,
        className,
      )}
    >
      {exam.shortName}
    </span>
  );
}

/*
 * Edge accents in the exam colour. Written out in full so Tailwind's scanner sees every class;
 * a side-specific colour is needed because a Card already sets its border colour to --rule.
 */
const TOP_EDGE: Record<ExamColorToken, string> = {
  '--exam-ka': 'border-t-4 border-t-exam-ka',
  '--exam-amc8': 'border-t-4 border-t-exam-amc8',
  '--exam-amc10': 'border-t-4 border-t-exam-amc10',
  '--exam-amc12': 'border-t-4 border-t-exam-amc12',
  '--exam-sat': 'border-t-4 border-t-exam-sat',
  '--exam-act': 'border-t-4 border-t-exam-act',
  '--exam-soon': 'border-t-4 border-t-exam-soon',
};

const LEFT_EDGE: Record<ExamColorToken, string> = {
  '--exam-ka': 'border-l-4 border-l-exam-ka',
  '--exam-amc8': 'border-l-4 border-l-exam-amc8',
  '--exam-amc10': 'border-l-4 border-l-exam-amc10',
  '--exam-amc12': 'border-l-4 border-l-exam-amc12',
  '--exam-sat': 'border-l-4 border-l-exam-sat',
  '--exam-act': 'border-l-4 border-l-exam-act',
  '--exam-soon': 'border-l-4 border-l-exam-soon',
};

/** A 4px top edge in the exam colour, for a card. */
export function examTopEdge(exam: Exam): string {
  return TOP_EDGE[exam.color];
}

/** A 4px left edge in the exam colour, for a card. */
export function examLeftEdge(exam: Exam): string {
  return LEFT_EDGE[exam.color];
}

export function gradesLabel(grades: { min: number; max: number }): string {
  return grades.min === grades.max ? `Grade ${grades.min}` : `Grades ${grades.min}-${grades.max}`;
}

export function minutesLabel(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${minutes} minutes`;
}

export function countLabel(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : `${noun}s`}`;
}

const CALCULATOR: Record<ExamFormat['calculator'], string> = {
  allowed: 'Allowed',
  'not allowed': 'Not allowed',
  'some parts': 'Some rounds only',
};

/** Format and scoring facts as a description list. */
export function ExamFacts({
  format,
  scoring,
  eligibility,
}: {
  format: ExamFormat;
  scoring: ExamScoring;
  eligibility?: string;
}) {
  const facts: Array<[string, string]> = [
    ['Questions', String(format.questions)],
    ['Time', minutesLabel(format.minutes)],
    [
      'Answers',
      format.choices === null ? 'Typed, no choices' : `Multiple choice, ${format.choices} choices`,
    ],
    ['Calculator', CALCULATOR[format.calculator]],
  ];
  if (format.parts.length > 1) {
    facts.push([
      'Parts',
      format.parts
        .map((part) => `${part.label}: ${part.questions} questions, ${part.minutes} minutes`)
        .join('; '),
    ]);
  }
  if (scoring.scale) {
    facts.push([scoring.scale.label, `${scoring.scale.min}-${scoring.scale.max}`]);
  }
  facts.push(['Scoring', scoring.summary]);
  if (eligibility) facts.push(['Who can sit it', eligibility]);

  return (
    <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-[max-content_minmax(0,1fr)]">
      {facts.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="ui text-xs font-semibold text-ink-2 sm:pt-0.5">{term}</dt>
          <dd className="m-0 -mt-2 text-sm text-ink sm:mt-0">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function learnLabel(href: string): string {
  if (href === '/atlas') return 'Learn: Skill Atlas';
  if (href.startsWith('/amc/formulas')) return 'Learn: formula sheet';
  return 'Learn';
}

/**
 * The exam's ways in: Practice, Mock test, Question bank and Learn as buttons, then a section
 * test link. Learn is left out where it is the same page as Practice (SAT and ACT, whose area
 * home is both). `bank` and `level` let the Kangaroo level picker point at one level.
 */
export function ExamActions({
  exam,
  bank,
  level,
}: {
  exam: Exam;
  bank?: string;
  level?: string | null;
}) {
  const { practice, mock, learn } = exam.routes;
  const bankHref = bank ?? exam.routes.bank;
  const section =
    exam.sessionExam === null ? null : sectionTestHref(exam.sessionExam, null, { level });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {practice ? (
        <ButtonLink href={practice} variant="primary">
          Practice
        </ButtonLink>
      ) : null}
      {mock ? <ButtonLink href={mock}>Mock test</ButtonLink> : null}
      {bankHref ? <ButtonLink href={bankHref}>Question bank</ButtonLink> : null}
      {learn && learn !== practice ? (
        <ButtonLink href={learn} variant="ghost">
          {learnLabel(learn)}
        </ButtonLink>
      ) : null}
      {section ? (
        <Link href={section} className="ui px-2 text-sm">
          Section tests
        </Link>
      ) : null}
    </div>
  );
}
