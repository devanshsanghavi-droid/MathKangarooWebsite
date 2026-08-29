import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { MockRunner } from '@/components/practice/MockRunner';
import { MOCK_MINUTES } from '@/lib/mock';

export const metadata: Metadata = {
  title: 'Sit a mock exam',
  description:
    'A full timed paper in the real shape: exact thirds at 3, 4 and 5 points, 75 minutes, no ' +
    'penalty for a wrong answer. No account needed, and a refresh does not lose your place.',
  alternates: { canonical: '/practice/mock' },
};

export default function MockPage() {
  const problems = getAllProblems();
  const skillNames = Object.fromEntries(getAllSkills().map((skill) => [skill.id, skill.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">Sit a mock exam</h1>
        <p className="mt-3 mb-0 text-ink-2">
          {MOCK_MINUTES} minutes, the real shape of the paper, and a report afterwards that shows
          where the points actually went rather than only what the total was. If you would rather
          find out what to work on than what you would score, take{' '}
          <Link href="/practice/diagnostic">the diagnostic</Link> instead.
        </p>
      </header>

      <div className="mt-8">
        <MockRunner problems={problems} skillNames={skillNames} />
      </div>
    </div>
  );
}
