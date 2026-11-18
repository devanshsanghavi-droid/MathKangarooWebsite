import type { Metadata } from 'next';
import Link from '@/components/AppLink';
import { getContentStats } from '@/lib/content';
import { getAmcCounts } from '@/lib/amc-content';
import { getTestCounts } from '@/lib/test-content';
import { TEST_AREAS } from '@/components/exams/test-area';
import { BetaBadge, ButtonLink, Card, PageContainer, PageHeader } from '@/components/ui';
import type { ReactNode } from 'react';

/**
 * `/exams` - every exam the site prepares for, on one page (docs/07 section 4). It is where
 * the mobile tab bar's "Exams" tab goes, and the top bar's "Exams" link below `lg`, so it has
 * to reach every area: Math Kangaroo (with its past papers), AMC 8, AMC 10 and 12, SAT and
 * ACT. Static; every count is read from the content files at build time.
 */
export const dynamic = 'force-static';

const TITLE = 'Exams';
const DESCRIPTION =
  'Free practice for Math Kangaroo, AMC 8, AMC 10, AMC 12, SAT Math and ACT Math: original ' +
  'problems, timed mock and section tests, and an explanation for every wrong answer.';

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/exams' },
    openGraph: { title: TITLE, description: DESCRIPTION, url: '/exams', type: 'website' },
  };
}

interface ExamLink {
  href: string;
  label: string;
}

interface Exam {
  id: string;
  name: ReactNode;
  /** Plain-text name, for the links' accessible names. */
  plainName: string;
  body: string;
  count: number;
  primary: ExamLink;
  more: ExamLink[];
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : `${noun}s`}`;
}

export default function ExamsPage() {
  const amc = getAmcCounts();
  const sat = getTestCounts('SAT');
  const act = getTestCounts('ACT');
  const exams: Exam[] = [
    {
      id: 'kangaroo',
      name: 'Math Kangaroo',
      plainName: 'Math Kangaroo',
      body: 'Levels 1-2 to 11-12, organised by skill. The Skill Atlas, a diagnostic, and every official past paper matched to its skills.',
      count: getContentStats().problems,
      primary: { href: '/', label: 'Start practicing' },
      more: [
        { href: '/problems', label: 'Question bank' },
        { href: '/papers', label: 'Past papers' },
        { href: '/practice/mock', label: 'Mock test' },
        { href: '/practice/section', label: 'Section test' },
      ],
    },
    {
      id: 'amc8',
      name: (
        <>
          AMC 8 <BetaBadge />
        </>
      ),
      plainName: 'AMC 8',
      body: 'Middle-school contest problems by area and topic, with the formulas worth knowing and the recurring problem types.',
      count: amc.byContest.get('AMC8') ?? 0,
      primary: { href: '/amc', label: 'Practice AMC 8' },
      more: [
        { href: '/amc/problems', label: 'Question bank' },
        { href: '/amc/mock', label: 'Mock test' },
      ],
    },
    {
      id: 'amc10-12',
      name: (
        <>
          AMC 10 and AMC 12 <BetaBadge />
        </>
      ),
      plainName: 'AMC 10 and AMC 12',
      body: `High-school contest problems: ${plural(amc.byContest.get('AMC10') ?? 0, 'problem')} on the AMC 10 and ${plural(amc.byContest.get('AMC12') ?? 0, 'problem')} on the AMC 12, many shared.`,
      // Every AMC problem that is not an AMC 8 problem is on the AMC 10, the AMC 12 or both.
      count: amc.total - (amc.byContest.get('AMC8') ?? 0),
      primary: { href: '/amc', label: 'Practice AMC 10 and 12' },
      more: [
        { href: '/amc/problems', label: 'Question bank' },
        { href: '/amc/formulas', label: 'Formula sheet' },
        { href: '/amc/mock', label: 'Mock test' },
      ],
    },
    ...(
      [
        ['SAT', sat.total],
        ['ACT', act.total],
      ] as const
    ).map(([test, count]) => {
      const area = TEST_AREAS[test];
      return {
        id: area.slug,
        name: area.name,
        plainName: area.name,
        body: `Questions by ${area.sectionNoun} and skill in the style of the real test, with a full timed mock: ${area.mockFormat}.`,
        count,
        primary: { href: `/${area.slug}`, label: `Practice ${area.name}` },
        more: [
          { href: `/${area.slug}/problems`, label: 'Question bank' },
          { href: `/${area.slug}/mock`, label: 'Mock test' },
          { href: `/${area.slug}/section`, label: 'Section test' },
        ],
      };
    }),
  ];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Exams"
        title="Choose an exam"
        description="Every problem on this site is written from scratch, and every wrong answer explains the mistake behind it. Nothing needs an account."
      />
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {exams.map((exam) => (
          <li key={exam.id} className="min-w-0">
            <Card
              as="article"
              aria-labelledby={`exam-${exam.id}`}
              className="flex h-full flex-col gap-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id={`exam-${exam.id}`} className="m-0 flex items-center gap-2 text-xl">
                  {exam.name}
                </h2>
                <span className="ui text-xs text-ink-2 tabular-nums">
                  {plural(exam.count, 'problem')}
                </span>
              </div>
              <p className="m-0 flex-1 text-sm text-ink-2">{exam.body}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <ButtonLink href={exam.primary.href} size="sm" variant="primary">
                  {exam.primary.label}
                </ButtonLink>
                <ul className="ui m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-sm">
                  {exam.more.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} aria-label={`${exam.plainName}: ${link.label}`}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-lg">Your progress, across every exam</h2>
          <p className="m-0 mt-1 text-sm text-ink-2">
            Accuracy by section, what needs practice, and how you are improving. It works without an
            account, from this browser.
          </p>
        </div>
        <ButtonLink href="/progress">See my progress</ButtonLink>
      </Card>
    </PageContainer>
  );
}
