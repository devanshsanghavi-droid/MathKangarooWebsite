import Link from 'next/link';
import type { PaperIndex } from '@/lib/schemas';
import { PointPill } from '@/components/PointPill';

/**
 * Our analysis of one official paper, question by question.
 *
 * What this table contains: a question number, a point value, our skill tags, and sometimes a
 * short characterisation in our own words. What it does not and will never contain: the
 * question, the figure, or the answer. See CLAUDE.md's first non-negotiable — the reader is
 * told this in plain language above the table, not just in a licence file.
 */
export function PaperQuestionTable({
  paper,
  skillNames,
}: {
  paper: PaperIndex;
  skillNames: ReadonlyMap<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only-caption mb-2 text-left text-xs text-ink-3">
          Our skill analysis of every question in this paper. The questions themselves are not
          reproduced here.
        </caption>
        <thead>
          <tr className="border-b border-rule-2 text-left">
            <th scope="col" className="py-2 pr-3 font-medium text-ink-2">
              #
            </th>
            <th scope="col" className="py-2 pr-3 font-medium text-ink-2">
              Points
            </th>
            <th scope="col" className="py-2 pr-3 font-medium text-ink-2">
              Skills we tagged
            </th>
            <th scope="col" className="py-2 font-medium text-ink-2">
              Our note
            </th>
          </tr>
        </thead>
        <tbody>
          {paper.questions.map((question) => (
            <tr key={question.number} className="border-b border-rule align-baseline">
              <th scope="row" className="mono py-2 pr-3 font-normal text-ink-3">
                {question.number}
              </th>
              <td className="py-2 pr-3">
                <PointPill points={question.points} />
              </td>
              <td className="py-2 pr-3">
                <ul className="m-0 flex flex-wrap list-none gap-x-3 gap-y-1 p-0">
                  {question.skills.map((skillId) => (
                    <li key={skillId}>
                      <Link href={`/skill/${skillId}`} className="no-underline hover:underline">
                        <span className="mono mr-1.5 text-2xs text-ink-3">{skillId}</span>
                        <span className="text-ink">{skillNames.get(skillId) ?? skillId}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="py-2 text-ink-2">{question.note ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
