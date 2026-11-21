import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { Badge, ButtonLink, Card, PageContainer, PageHeader } from '@/components/ui';
import { examById, liveExams, soonExams, type Exam } from '@/lib/exams';
import { TESTS_HUB } from '@/lib/site';
import { examQuestionCount } from '@/components/exams/exam-page-data';
import {
  ExamChip,
  countLabel,
  examLeftEdge,
  examTopEdge,
  gradesLabel,
} from '@/components/exams/ExamBits';

/**
 * `/exams` - the exam catalog (docs/08 items 1-3): one card per live exam in its colour, with
 * grades, format, question count and the ways in, then a "Coming soon" row whose cards point
 * at the related live exam. Every card links its exam page (/exams/<id>). It is where the
 * "Practice" tab and top-bar link go. Static; everything is read from src/lib/exams.ts and the
 * content files at build time.
 */
export const dynamic = 'force-static';

const TITLE = 'Every math exam in one place';
const DESCRIPTION =
  'Free practice for Math Kangaroo, AMC 8, AMC 10, AMC 12, SAT Math and ACT Math: the format ' +
  'and scoring of each exam, original problems, timed mock and section tests, and an ' +
  'explanation for every wrong answer. AIME, MATHCOUNTS and PSAT coming soon.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/exams' },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/exams', type: 'website' },
  };
}

interface CardLink {
  href: string;
  label: string;
}

function moreLinks(exam: Exam): CardLink[] {
  const links: CardLink[] = [];
  if (exam.routes.mock) links.push({ href: exam.routes.mock, label: 'Mock test' });
  if (exam.routes.bank) links.push({ href: exam.routes.bank, label: 'Question bank' });
  if (exam.id === 'ka') links.push({ href: '/papers', label: 'Past papers' });
  links.push({ href: exam.routes.page, label: 'Format and tips' });
  return links;
}

function LiveExamCard({ exam, count }: { exam: Exam; count: number }) {
  return (
    <Card
      as="article"
      aria-labelledby={`exam-${exam.id}`}
      className={`flex h-full flex-col gap-3 ${examTopEdge(exam)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ExamChip exam={exam} />
        <span className="ui text-xs text-ink-2 tabular-nums">{countLabel(count, 'problem')}</span>
      </div>
      <div>
        <h2 id={`exam-${exam.id}`} className="m-0 text-xl">
          <Link href={exam.routes.page} className="text-ink no-underline hover:underline">
            {exam.name}
          </Link>
        </h2>
        <p className="ui m-0 mt-1 text-xs text-ink-2">
          {gradesLabel(exam.grades)}
          {exam.tracks.length > 0 ? `, ${exam.tracks.length} levels` : ''}.{' '}
          {exam.tracks.length > 0 ? 'Up to ' : ''}
          {exam.format.summary}.
        </p>
      </div>
      <p className="m-0 flex-1 text-sm text-ink-2">{exam.blurb}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {exam.routes.practice ? (
          <ButtonLink
            href={exam.routes.practice}
            size="sm"
            variant="primary"
            aria-label={`Practice ${exam.name}`}
          >
            Practice
          </ButtonLink>
        ) : null}
        <ul className="ui m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-sm">
          {moreLinks(exam).map((link) => (
            <li key={link.href}>
              <Link href={link.href} aria-label={`${exam.name}: ${link.label}`}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function SoonExamCard({ exam }: { exam: Exam }) {
  const related = exam.related ? examById(exam.related) : undefined;
  return (
    <Card
      as="article"
      aria-labelledby={`exam-${exam.id}`}
      padding="sm"
      className={`flex h-full flex-col gap-2 ${examLeftEdge(exam)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`exam-${exam.id}`} className="m-0 text-base">
          <Link href={exam.routes.page} className="text-ink no-underline hover:underline">
            {exam.name}
          </Link>
        </h3>
        <Badge tone="outline">Coming soon</Badge>
      </div>
      <p className="ui m-0 text-xs text-ink-2">
        {gradesLabel(exam.grades)}. {exam.format.summary}.
      </p>
      {related ? (
        <p className="m-0 text-sm">
          <Link href={related.routes.page}>Practise {related.name} meanwhile</Link>
        </p>
      ) : null}
    </Card>
  );
}

export default function ExamsPage() {
  const live = liveExams();
  const soon = soonExams();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Exams"
        title="Every math exam in one place"
        description="Pick an exam for its format, scoring and tips, then practise by topic or sit a timed mock. Every problem here is written from scratch, every wrong answer explains the mistake behind it, and nothing needs an account."
        actions={<ButtonLink href={TESTS_HUB}>All mock and section tests</ButtonLink>}
      />
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
        {live.map((exam) => (
          <li key={exam.id} className="min-w-0">
            <LiveExamCard exam={exam} count={examQuestionCount(exam)} />
          </li>
        ))}
      </ul>

      <section aria-labelledby="exams-soon" className="mt-8">
        <h2 id="exams-soon" className="m-0 mb-1 text-lg">
          Coming soon
        </h2>
        <p className="m-0 mb-3 text-sm text-ink-2">
          No questions yet. Each one points at the closest exam you can practise now.
        </p>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {soon.map((exam) => (
            <li key={exam.id} className="min-w-0">
              <SoonExamCard exam={exam} />
            </li>
          ))}
        </ul>
      </section>

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-lg">Your progress, across every exam</h2>
          <p className="m-0 mt-1 text-sm text-ink-2">
            Accuracy by topic, what needs practice, and how your test scores are moving. It works
            without an account, from this browser.
          </p>
        </div>
        <ButtonLink href="/progress">See my progress</ButtonLink>
      </Card>
    </PageContainer>
  );
}
