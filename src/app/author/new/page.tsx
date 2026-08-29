import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { FIGURE_NAMES } from '@/components/figures/registry';
import { nextProblemId } from '@/lib/author';
import { SITE } from '@/lib/site';
import { AuthorForm } from './AuthorForm';
import { Callout } from '@/components/Callout';

export const metadata: Metadata = {
  title: 'Write a problem',
  description:
    'A form that produces a valid problem file, validated against the same schema CI runs, ' +
    'with a live preview and a one-click pull request.',
  alternates: { canonical: '/author/new' },
  robots: { index: false },
};

export default function AuthorNewPage() {
  const problems = getAllProblems();
  const usedProblemIds = problems.map((problem) => problem.id);
  const knownSkillIds = getAllSkills().map((skill) => skill.id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">Write a problem</h1>
        <p className="mt-3 mb-0 text-ink-2">
          This form produces a problem file. It is checked against the same schema CI runs, so when
          it says valid, the file will pass <code className="mono">pnpm validate:content</code>{' '}
          without a single edit.
        </p>
      </header>

      <div className="mt-6 max-w-prose">
        <Callout title="Before you start">
          <p className="m-0">
            Read{' '}
            <Link href={`${SITE.repo}/blob/main/docs/03-CONTENT-GUIDE.md`}>the content guide</Link>,
            especially part B3 on distractors. The highest-value twenty minutes you will spend on
            any problem is on the four wrong answers: write the mistake first, then the number it
            produces.
          </p>
          <p className="mt-2 mb-0">
            <strong>
              Never copy, retype, translate or closely paraphrase an official Math Kangaroo problem.
            </strong>{' '}
            Change the mathematical situation, not just the nouns. If you are unsure whether
            something is too close, it is.
          </p>
        </Callout>
      </div>

      <div className="mt-8">
        <AuthorForm
          knownSkillIds={knownSkillIds}
          usedProblemIds={usedProblemIds}
          nextId={nextProblemId(usedProblemIds)}
          today={today}
          repo={SITE.repo}
          figureNames={FIGURE_NAMES}
        />
      </div>
    </div>
  );
}
