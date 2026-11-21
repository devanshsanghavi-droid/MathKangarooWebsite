import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { ButtonLink, Card, PageContainer, PageHeader } from '@/components/ui';
import { SECTION_TEST_SIZE, sectionTestHref } from '@/lib/exam-engine';
import { liveExams } from '@/lib/exams';
import { ExamChip, examTopEdge, gradesLabel } from '@/components/exams/ExamBits';

/**
 * `/exams/tests` - every exam's timed tests on one page (docs/08 item 13): where the mobile
 * tab bar's and the top bar's "Tests" go. One card per live exam with its full mock (in the
 * real format and time) and its section tests, read from the exam catalog. Static.
 */
export const dynamic = 'force-static';

const TITLE = 'Mock and section tests';
const DESCRIPTION =
  'Free timed mock tests in the real format for Math Kangaroo, AMC 8, AMC 10, AMC 12, SAT ' +
  'Math and ACT Math, and short section tests on one topic. Original questions, no account.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/exams/tests' },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/exams/tests', type: 'website' },
  };
}

export default function TestsPage() {
  const exams = liveExams();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Tests"
        title="Mock and section tests"
        description={`A mock is a full paper in the real format and time, scored the way the exam scores it. A section test is ${SECTION_TEST_SIZE} questions from one topic. Both save as you go, so a refresh never loses your place, and neither needs an account.`}
      />
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => {
          const section = exam.sessionExam ? sectionTestHref(exam.sessionExam) : null;
          const format =
            exam.tracks.length > 0
              ? `${exam.tracks[0]?.format.summary ?? ''} for levels 1-2 and 3-4; ${exam.format.summary} above`
              : exam.format.summary;
          return (
            <li key={exam.id} className="min-w-0">
              <Card
                as="article"
                aria-labelledby={`tests-${exam.id}`}
                className={`flex h-full flex-col gap-3 ${examTopEdge(exam)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ExamChip exam={exam} />
                  <span className="ui text-xs text-ink-2">{gradesLabel(exam.grades)}</span>
                </div>
                <h2 id={`tests-${exam.id}`} className="m-0 text-lg">
                  {exam.name}
                </h2>
                <p className="m-0 flex-1 text-sm text-ink-2">Mock: {format}.</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {exam.routes.mock ? (
                    <ButtonLink
                      href={exam.routes.mock}
                      size="sm"
                      variant="primary"
                      aria-label={`${exam.name} mock test`}
                    >
                      Mock test
                    </ButtonLink>
                  ) : null}
                  {section ? (
                    <ButtonLink href={section} size="sm" aria-label={`${exam.name} section test`}>
                      Section test
                    </ButtonLink>
                  ) : null}
                  <Link
                    href={exam.routes.page}
                    className="ui text-sm"
                    aria-label={`${exam.name} format and tips`}
                  >
                    Format and tips
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-lg">Not sure where to start?</h2>
          <p className="m-0 mt-1 text-sm text-ink-2">
            The Kangaroo diagnostic finds the skills worth working on, rather than a score.
          </p>
        </div>
        <ButtonLink href="/practice/diagnostic">Take the diagnostic</ButtonLink>
      </Card>
    </PageContainer>
  );
}
