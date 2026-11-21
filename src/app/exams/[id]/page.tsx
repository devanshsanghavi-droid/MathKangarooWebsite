import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from '@/components/AppLink';
import { Badge, ButtonLink, Card, PageContainer, PageHeader } from '@/components/ui';
import { EXAM_SPECS } from '@/lib/exam-engine';
import { EXAMS, examById, type Exam } from '@/lib/exams';
import { examPageData, type ExamPageData } from '@/components/exams/exam-page-data';
import {
  ExamActions,
  ExamChip,
  ExamFacts,
  countLabel,
  examLeftEdge,
  examTopEdge,
  gradesLabel,
} from '@/components/exams/ExamBits';
import { ExamTopics } from '@/components/exams/ExamTopics';
import { ExamScoreChart } from '@/components/exams/ExamScoreChart';
import { KangarooLevels } from '@/components/exams/KangarooLevels';

interface Params {
  params: Promise<{ id: string }>;
}

/** Every catalog exam is a static page; anything else is a real 404. */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return EXAMS.map((exam) => ({ id: exam.id }));
}

function describe(exam: Exam): string {
  if (exam.status === 'soon') {
    return (
      `${exam.name}: the format, scoring and who can sit it. Practice for ${exam.name} is ` +
      'coming soon; meanwhile, practise for the closest exam on this site.'
    );
  }
  return (
    `${exam.name} format (${exam.format.summary}), scoring, test-day tips and topics, with ` +
    'free original practice questions, mock tests and your accuracy by topic. No account needed.'
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const exam = examById(id);
  if (!exam) return { title: 'Exam not found', robots: { index: false } };
  const title =
    exam.status === 'soon'
      ? `${exam.name}: format and scoring (coming soon)`
      : `${exam.name}: format, scoring and tips`;
  const description = describe(exam);
  const path = exam.routes.page;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: 'article' },
  };
}

/** "Strand", "Area", "Domain", "Category": what one topic of this exam's bank is called. */
function topicNoun(exam: Exam): string {
  if (!exam.sessionExam) return 'Topic';
  const noun = EXAM_SPECS[exam.sessionExam].sectionNoun;
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

function sectionNames(data: ExamPageData, exam: Exam): Record<string, string> {
  return Object.fromEntries(
    (data.spec?.sections ?? []).map((section) => [
      section.id,
      exam.topicNames[section.id] ?? section.name,
    ]),
  );
}

function Tips({ exam }: { exam: Exam }) {
  return (
    <Card as="section" aria-labelledby="exam-tips">
      <h2 id="exam-tips" className="m-0 mb-3 text-lg">
        Test-day tips
      </h2>
      <ul className="m-0 grid gap-2 pl-5 text-sm text-ink">
        {exam.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </Card>
  );
}

function ScoreCard({ exam, data }: { exam: Exam; data: ExamPageData }) {
  return (
    <Card as="section" aria-labelledby="exam-scores">
      <h2 id="exam-scores" className="m-0 mb-1 text-lg">
        Your scores
      </h2>
      <p className="m-0 mb-3 text-sm text-ink-2">
        Your {exam.shortName} mock and section tests over time, from this browser.
      </p>
      <ExamScoreChart examId={exam.id} sectionNames={sectionNames(data, exam)} />
    </Card>
  );
}

function RelatedLink({ exam }: { exam: Exam }) {
  const related = exam.related ? examById(exam.related) : undefined;
  if (!related) return null;
  return (
    <p className="ui m-0 text-sm text-ink-2">
      Related exam: <Link href={related.routes.page}>{related.name}</Link>.{' '}
      <Link href="/exams">Every exam</Link>.
    </p>
  );
}

function SoonExamPage({ exam }: { exam: Exam }) {
  const related = exam.related ? examById(exam.related) : undefined;
  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <>
            <ExamChip exam={exam} />
            <Badge tone="outline">Coming soon</Badge>
          </>
        }
        title={exam.name}
        description={exam.blurb}
      />
      <div className="grid gap-6">
        {related ? (
          <Card
            as="section"
            aria-labelledby="exam-meanwhile"
            padding="lg"
            className={examLeftEdge(related)}
          >
            <h2 id="exam-meanwhile" className="m-0 text-xl">
              Practise for {related.name} meanwhile
            </h2>
            <p className="m-0 mt-2 text-sm text-ink-2">
              There are no {exam.shortName} questions here yet. {related.name} covers the closest
              ground, with original questions, mock tests and an explanation for every wrong answer.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={related.routes.page} variant="primary">
                Go to {related.name}
              </ButtonLink>
              {related.routes.practice ? (
                <ButtonLink href={related.routes.practice}>Start practicing</ButtonLink>
              ) : null}
            </div>
          </Card>
        ) : null}
        <Card as="section" aria-labelledby="exam-format" className={examTopEdge(exam)}>
          <h2 id="exam-format" className="m-0 mb-1 text-lg">
            Format
          </h2>
          <p className="m-0 mb-4 text-sm text-ink-2">
            Usually taken in {gradesLabel(exam.grades).toLowerCase()}.
          </p>
          <ExamFacts format={exam.format} scoring={exam.scoring} eligibility={exam.eligibility} />
        </Card>
        <p className="ui m-0 text-sm text-ink-2">
          <Link href="/exams">See every exam</Link>
        </p>
      </div>
    </PageContainer>
  );
}

/**
 * `/exams/[id]` (docs/08 item 3): one page per catalog exam, static. A live exam gets its
 * format, scoring, test-day tips, eligibility, topics with question counts, and the ways in
 * (practice, mock, bank, learn), plus two client islands that read this browser's progress:
 * accuracy per topic and a score chart. Kangaroo adds a level picker. A coming-soon exam gets
 * a short page pointing at the related live exam.
 */
export default async function ExamPage({ params }: Params) {
  const { id } = await params;
  const exam = examById(id);
  if (!exam) notFound();
  if (exam.status === 'soon') return <SoonExamPage exam={exam} />;

  const data = examPageData(exam);
  const header = (
    <PageHeader
      eyebrow={
        <>
          <ExamChip exam={exam} />
          <span>Exam guide</span>
        </>
      }
      title={exam.name}
      description={`${exam.blurb} ${gradesLabel(exam.grades)}, ${countLabel(data.total, 'practice question')} here.`}
    />
  );

  if (exam.tracks.length > 0) {
    return (
      <PageContainer>
        {header}
        <div className="grid gap-6">
          <KangarooLevels
            byTrack={data.byTrack}
            totalByTrack={data.totalByTrack}
            spec={data.spec}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Tips exam={exam} />
            <ScoreCard exam={exam} data={data} />
          </div>
          <RelatedLink exam={exam} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {header}
      <div className="grid gap-6">
        <ExamActions exam={exam} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card as="section" aria-labelledby="exam-format" className={examTopEdge(exam)}>
            <h2 id="exam-format" className="m-0 mb-4 text-lg">
              Format and scoring
            </h2>
            <ExamFacts format={exam.format} scoring={exam.scoring} eligibility={exam.eligibility} />
          </Card>
          <Tips exam={exam} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card as="section" aria-labelledby="exam-topics">
            <h2 id="exam-topics" className="m-0 mb-1 text-lg">
              Topics
            </h2>
            <p className="m-0 mb-3 text-sm text-ink-2">
              Questions in our bank by {topicNoun(exam).toLowerCase()}, and your accuracy in each.
            </p>
            <ExamTopics rows={data.topics} spec={data.spec} noun={topicNoun(exam)} />
          </Card>
          <ScoreCard exam={exam} data={data} />
        </div>
        <RelatedLink exam={exam} />
      </div>
    </PageContainer>
  );
}
