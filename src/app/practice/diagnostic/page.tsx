import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { DiagnosticRunner } from '@/components/practice/DiagnosticRunner';
import { toAssessmentProblem, toAssessmentSkill } from '@/lib/assessment';

export const metadata: Metadata = {
  title: 'Take the diagnostic',
  description:
    'Fifteen adaptive questions, about twenty-five minutes. It branches on the skill graph, ' +
    'so a miss sends you to what that skill rests on. No account needed.',
  alternates: { canonical: '/practice/diagnostic' },
};

/**
 * The whole content bank is handed to the client so the diagnostic can branch without a round
 * trip - the alternative is an API call between every question, and the point of this page is
 * that it needs no account and no server at all.
 *
 * It is handed over TRIMMED (`@/lib/assessment`): only what an assessment shows and the
 * branching reads. Hints, solutions, misconceptions and authoring metadata never render here,
 * and serialising them made this page's prerendered payload about four times larger - a
 * payload the Cloudflare worker parses on every request.
 */
export default function DiagnosticPage() {
  const allSkills = getAllSkills();
  const skills = allSkills.map(toAssessmentSkill);
  const problems = getAllProblems().map(toAssessmentProblem);
  const skillNames = Object.fromEntries(allSkills.map((skill) => [skill.id, skill.name]));

  return (
    <div className="content-column px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">Take the diagnostic</h1>
        <p className="mt-3 mb-0 text-ink-2">
          A score out of 120 tells you nothing you can act on. This gives you a map instead: which
          skills are solid, which are not, and - because it follows the{' '}
          <Link href="/atlas">prerequisite graph</Link> - what has to come first.
        </p>
      </header>

      <div className="mt-8">
        <DiagnosticRunner content={{ skills, problems }} skillNames={skillNames} />
      </div>
    </div>
  );
}
