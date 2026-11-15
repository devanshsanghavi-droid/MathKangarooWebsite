import { SkillRail } from './SkillRail';
import { railStrands } from '@/lib/rail';

/**
 * The two-column frame for the sections that carry the skill rail: /atlas and /skill
 * (`RAIL_ROUTES` in lib/site.ts). At 900px and up it is a 260px rail beside the content; below
 * that the rail collapses to its "Skills" drawer button above the content.
 *
 * It used to live in the root layout, which had two costs. Every page on the site paid for
 * the rail's 91-skill tree in its payload even though only these two sections draw it, and
 * the root layout read the content index on every request, so /login, /admin and every 404
 * pulled the whole server content bundle into the worker (docs/06 §3 says no request-time
 * path may need it). Both sections are fully static, so here the tree is built once, at
 * build time.
 */
export function RailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col shell:grid shell:grid-cols-[auto_1fr] shell:items-start">
      <SkillRail strands={railStrands()} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
