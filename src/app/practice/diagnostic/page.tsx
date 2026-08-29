import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { DiagnosticRunner } from '@/components/practice/DiagnosticRunner';

export const metadata: Metadata = {
  title: 'Take the diagnostic',
  description:
    'Fifteen adaptive questions, about twenty-five minutes. It branches on the skill graph, ' +
    'so a miss sends you to what that skill rests on. No account needed.',
  alternates: { canonical: '/practice/diagnostic' },
};

/**
 * The whole content bank is handed to the client so the diagnostic can branch without a round
 * trip. That is ~150 problems of JSON, which is a real cost — but the alternative is an API
 * call between every question, and the point of this page is that it needs no account and no
 * server at all.
 */
export default function DiagnosticPage() {
  const skills = getAllSkills();
  const problems = getAllProblems();
  const skillNames = Object.fromEntries(skills.map((skill) => [skill.id, skill.name]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">Take the diagnostic</h1>
        <p className="mt-3 mb-0 text-ink-2">
          A score out of 120 tells you nothing you can act on. This gives you a map instead: which
          skills are solid, which are not, and — because it follows the{' '}
          <Link href="/atlas">prerequisite graph</Link> — what has to come first.
        </p>
      </header>

      <div className="mt-8">
        <DiagnosticRunner content={{ skills, problems }} skillNames={skillNames} />
      </div>
    </div>
  );
}
