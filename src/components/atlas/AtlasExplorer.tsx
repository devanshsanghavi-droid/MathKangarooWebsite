'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { STRANDS } from '@/lib/schemas';
import { STRAND_META } from '@/lib/taxonomy-meta';
import { layoutAtlas, tierBands } from '@/lib/atlas-layout';
import { atlasHref, EMPTY_QUERY, parseAtlasQuery, type AtlasQuery } from '@/lib/atlas-params';
import { filterAtlasSkills, searchToRaw, type AtlasSkill } from '@/lib/atlas-data';
import { AtlasFilters } from './AtlasFilters';
import { AtlasViewToggle } from './AtlasViewToggle';
import { AtlasGraph } from './AtlasGraph';
import { AtlasList } from './AtlasList';
import { SkillPanel } from './SkillPanel';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui';

/**
 * The interactive Atlas: filters, graph or list, and the focused-skill panel.
 *
 * The page around it is fully static (docs/06-V3-REDESIGN.md §3): the server renders the
 * unfiltered graph once at build time, and everything after that happens here. On load the
 * query string is read back, so a shared `/atlas?strand=GEO&focus=GEO-10` still opens on that
 * view; every change is written back with history.replaceState, so the address bar always
 * describes what is on screen without adding a history entry per click.
 */
export function AtlasExplorer({ skills }: { skills: readonly AtlasSkill[] }) {
  const [query, setQuery] = useState<AtlasQuery>(EMPTY_QUERY);

  // Read the shared view back from the address bar once, after hydration.
  useEffect(() => {
    const fromUrl = parseAtlasQuery(searchToRaw(window.location.search));
    setQuery(fromUrl);
  }, []);

  const update = useCallback((next: AtlasQuery) => {
    setQuery(next);
    try {
      window.history.replaceState(null, '', atlasHref(next));
    } catch {
      // A sandboxed frame can refuse replaceState. The view still changes; only the URL lags.
    }
  }, []);

  const byId = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const visible = useMemo(() => filterAtlasSkills(skills, query), [skills, query]);
  const problemCounts = useMemo(
    () => new Map(skills.map((skill) => [skill.id, skill.problemCount])),
    [skills],
  );
  const layout = useMemo(() => layoutAtlas(visible, problemCounts), [visible, problemCounts]);
  const focused = query.focus ? byId.get(query.focus) : undefined;
  const resolve = (ids: readonly string[]) =>
    ids.map((id) => byId.get(id)).filter((skill): skill is AtlasSkill => skill !== undefined);

  const clearFilters = () =>
    update({ ...query, strands: [], band: null, points: null, hasProblems: false });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <AtlasViewToggle view={query.view} onChange={(view) => update({ ...query, view })} />
        <p className="ui m-0 text-xs text-ink-2">
          The list view holds the same skills and is often the faster way in.
        </p>
      </div>

      <AtlasFilters query={query} resultCount={visible.length} onChange={update} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          className="min-w-0"
          aria-label={query.view === 'graph' ? 'Skill graph' : 'Skill list'}
        >
          {visible.length === 0 ? (
            <EmptyState
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear the filters
                </Button>
              }
            >
              No skill matches these filters. The Atlas has {skills.length} skills in total.
            </EmptyState>
          ) : query.view === 'graph' ? (
            <AtlasGraph
              layout={layout}
              focus={query.focus}
              onFocus={(id) => update({ ...query, focus: id })}
              bands={tierBands(layout)}
            />
          ) : (
            <AtlasList skills={visible} problemCounts={problemCounts} focus={query.focus} />
          )}
        </section>

        <div className="lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:self-start">
          {focused ? (
            <SkillPanel
              skill={focused}
              prerequisites={resolve(focused.prerequisites)}
              unlocks={resolve(focused.unlocks)}
              onClose={() => update({ ...query, focus: null })}
            />
          ) : (
            <div className="rounded-card border border-dashed border-rule-strong p-5">
              <p className="ui m-0 text-sm text-ink-2">
                Choose a skill to see what it is, what it needs first, and what it opens up.
              </p>
              <ul className="mt-3 mb-0 grid list-none gap-1 p-0 text-sm">
                {STRANDS.map((strand) => (
                  <li key={strand}>
                    <Link
                      href={`/atlas/${strand}`}
                      className="flex min-h-8 items-center no-underline hover:underline"
                    >
                      <span className="mono mr-2 text-2xs text-ink-3">{strand}</span>
                      {STRAND_META[strand].name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
