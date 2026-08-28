import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getAllSkills,
  getProblemsForSkill,
  getSkill,
  STRAND_META,
  getContentStats,
} from '@/lib/content';
import { layoutAtlas, tierBands } from '@/lib/atlas-layout';
import { atlasHref, parseAtlasQuery, type RawSearchParams } from '@/lib/atlas-params';
import { AtlasFilters } from '@/components/atlas/AtlasFilters';
import { AtlasViewToggle } from '@/components/atlas/AtlasViewToggle';
import { AtlasGraph } from '@/components/atlas/AtlasGraph';
import { AtlasList } from '@/components/atlas/AtlasList';
import { SkillPanel } from '@/components/atlas/SkillPanel';
import { EmptyState } from '@/components/EmptyState';
import type { Skill } from '@/lib/schemas';

export const metadata: Metadata = {
  title: 'The Skill Atlas',
  description:
    'Every skill Math Kangaroo tests, in a prerequisite graph. Seven strands, 91 skills, ' +
    'foundation through to the 5-point gateways. Browse it as a diagram or as a list.',
  alternates: { canonical: '/atlas' },
};

/**
 * The map. `docs/00-SPEC.md` §1.2 calls it the single most important page on the site.
 *
 * Filtering, focus and view are all URL state, so the whole page is server-rendered and a view
 * is shareable. Only pan and zoom are client state, because nobody wants to share those.
 */
export default async function AtlasPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const query = parseAtlasQuery(await searchParams);
  const all = getAllSkills();
  const problemCounts = new Map(
    all.map((skill) => [skill.id, getProblemsForSkill(skill.id).length]),
  );

  const visible = all.filter((skill) => {
    if (query.strands.length > 0 && !query.strands.includes(skill.strand)) return false;
    if (query.band && !skill.bands.includes(query.band)) return false;
    if (query.hasProblems && (problemCounts.get(skill.id) ?? 0) === 0) return false;
    if (query.points !== null) {
      const hasTier = getProblemsForSkill(skill.id).some((p) => p.points === query.points);
      if (!hasTier) return false;
    }
    return true;
  });

  const layout = layoutAtlas(visible, problemCounts);
  const focused = query.focus ? getSkill(query.focus) : undefined;
  const resolve = (ids: readonly string[]): Skill[] =>
    ids.map((id) => getSkill(id)).filter((skill): skill is Skill => skill !== undefined);
  const stats = getContentStats();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="max-w-prose">
        <h1 className="m-0 text-2xl">The Skill Atlas</h1>
        <p className="mt-3 mb-0 text-ink-2">
          Every skill Math Kangaroo tests, arranged so that each one sits below what it needs first.{' '}
          {stats.skills} skills across seven strands. Follow an arrow downward and you are following
          what a student can learn next.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <AtlasViewToggle query={query} />
        <p className="m-0 text-xs text-ink-3">
          The list view holds the same skills and is often the faster way in.
        </p>
      </div>

      <div className="mt-4">
        <AtlasFilters query={query} resultCount={visible.length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label={query.view === 'graph' ? 'Skill graph' : 'Skill list'}>
          {visible.length === 0 ? (
            <EmptyState
              action={<Link href={atlasHref({ view: query.view })}>Clear the filters</Link>}
            >
              No skill matches these filters. The Atlas has {all.length} skills in total.
            </EmptyState>
          ) : query.view === 'graph' ? (
            <AtlasGraph layout={layout} query={query} bands={tierBands(layout)} />
          ) : (
            <AtlasList skills={visible} problemCounts={problemCounts} query={query} />
          )}
        </section>

        <div className="lg:sticky lg:top-20 lg:self-start">
          {focused ? (
            <SkillPanel
              skill={focused}
              problemCount={problemCounts.get(focused.id) ?? 0}
              prerequisites={resolve(focused.prerequisites)}
              unlocks={resolve(focused.unlocks)}
              query={query}
            />
          ) : (
            <div className="rounded-md border border-dashed border-rule p-4">
              <p className="m-0 text-sm text-ink-2">
                Choose a skill to see what it is, what it needs first, and what it opens up.
              </p>
              <ul className="mt-3 mb-0 grid list-none gap-1.5 p-0 text-sm">
                {Object.entries(STRAND_META).map(([strand, meta]) => (
                  <li key={strand}>
                    <Link href={`/atlas/${strand}`} className="no-underline hover:underline">
                      <span className="mono mr-2 text-2xs text-ink-3">{strand}</span>
                      {meta.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
