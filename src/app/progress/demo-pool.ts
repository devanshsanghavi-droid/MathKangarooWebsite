import { getAllProblems } from '@/lib/content';
import type { DemoKaProblem } from '@/lib/demo-progress';

/** How many Kangaroo problems the demo student draws from. */
const DEMO_KA_COUNT = 60;

/**
 * The Kangaroo problems the /progress demo student answers (docs/08 item 7): ids, skill tags
 * and points only, spread evenly across the 7-8 level. BUILD-TIME ONLY (reads content from
 * disk); the page passes the result to the client, so it stays a few kilobytes.
 */
export function demoKaProblems(): DemoKaProblem[] {
  const level = getAllProblems()
    .filter((p) => p.band === '7-8')
    .sort((a, b) => a.id.localeCompare(b.id));
  const step = Math.max(1, Math.floor(level.length / DEMO_KA_COUNT));
  return level
    .filter((_, i) => i % step === 0)
    .slice(0, DEMO_KA_COUNT)
    .map((p) => ({
      id: p.id,
      skills: [p.skills.primary, ...p.skills.secondary],
      points: p.points,
    }));
}
