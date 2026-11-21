import type { MetadataRoute } from 'next';
import { SITE, TESTS_HUB } from '@/lib/site';
import { contentIndex, paperKey } from '@/lib/content';
import { STRANDS } from '@/lib/schemas';
import { getAllAmcProblems, getAmcTaxonomy } from '@/lib/amc-content';
import { getAllTestProblems } from '@/lib/test-content';
import { STD_TESTS, TEST_SLUG } from '@/lib/test-meta';
import { EXAMS } from '@/lib/exams';

/**
 * The sitemap is generated from content, not hand-listed: adding a skill file adds its page
 * here with no second edit. Priorities encode what the site is for - the Atlas and the skill
 * pages are the point, the legal pages are not.
 */
export const STATIC_ROUTES = [
  { path: '/', priority: 1 },
  { path: '/atlas', priority: 0.9 },
  { path: '/problems', priority: 0.8 },
  { path: '/papers', priority: 0.7 },
  { path: '/about', priority: 0.5 },
  { path: '/contact', priority: 0.3 },
] as const;

/**
 * The AMC beta's own pages (docs/06 §5). /amc/practice is left out: it is a noindex tool page
 * whose content comes from the query string. The flashcards are a tool too, but the page is
 * the only explanation of the drill, so it is listed at a low priority.
 */
export const AMC_ROUTES = [
  { path: '/amc', priority: 0.7 },
  { path: '/amc/problems', priority: 0.6 },
  { path: '/amc/types', priority: 0.6 },
  { path: '/amc/formulas', priority: 0.6 },
  { path: '/amc/formulas/drill', priority: 0.3 },
] as const;

/**
 * The exams hub and the SAT and ACT areas (docs/07 section 4). As with AMC, /sat/practice and
 * /act/practice are noindex tool pages and are left out.
 */
export const EXAM_ROUTES = [
  { path: '/exams', priority: 0.7 },
  { path: '/sat', priority: 0.7 },
  { path: '/sat/problems', priority: 0.6 },
  { path: '/act', priority: 0.7 },
  { path: '/act/problems', priority: 0.6 },
] as const;

/**
 * The mock and section-test pages (docs/07 section 4). Unlike the practice runners they are
 * listed: each has a fixed, prerendered page explaining the format, and the query string only
 * preselects a choice. Low priority, because they are tools.
 */
export const TIMED_TEST_ROUTES = [
  { path: TESTS_HUB, priority: 0.5 },
  { path: '/practice/section', priority: 0.4 },
  { path: '/amc/mock', priority: 0.5 },
  { path: '/amc/section', priority: 0.4 },
  { path: '/sat/mock', priority: 0.5 },
  { path: '/sat/section', priority: 0.4 },
  { path: '/act/mock', priority: 0.5 },
  { path: '/act/section', priority: 0.4 },
] as const;

/*
 * The three /legal pages are deliberately absent. They are marked noindex, and listing a
 * noindex URL in a sitemap sends a crawler two contradictory instructions. They were also
 * the pages outranking the home page for the site's own name.
 */

export default function sitemap(): MetadataRoute.Sitemap {
  const index = contentIndex();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE.url}${route.path}`,
    changeFrequency: 'weekly' as const,
    priority: route.priority,
  }));

  for (const strand of STRANDS) {
    entries.push({
      url: `${SITE.url}/atlas/${strand}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  for (const skill of index.skills) {
    entries.push({
      url: `${SITE.url}/skill/${skill.id}`,
      changeFrequency: 'monthly',
      priority: 0.8,
    });
    /*
     * The unit page is mostly navigation now (docs/05 §7.2); /learn is where the definition,
     * the recognition cues, the worked example and the misconceptions actually live, so it is
     * listed in its own right.
     *
     * The three ladders and the quiz are deliberately NOT listed. They are tools rather than
     * documents - 364 pages whose prose is "practise X at tier N" - and they are reachable
     * from the unit page anyway. Listing them would be thin content by the cartload.
     */
    entries.push({
      url: `${SITE.url}/skill/${skill.id}/learn`,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  for (const problem of index.problems) {
    entries.push({
      url: `${SITE.url}/problem/${problem.id}`,
      changeFrequency: 'monthly',
      priority: 0.6,
      lastModified: new Date(problem.createdAt),
    });
  }

  for (const paper of index.papers) {
    entries.push({
      url: `${SITE.url}/papers/${paperKey(paper.year, paper.band)}`,
      changeFrequency: 'yearly',
      priority: 0.4,
    });
  }

  for (const route of AMC_ROUTES) {
    entries.push({
      url: `${SITE.url}${route.path}`,
      changeFrequency: 'weekly',
      priority: route.priority,
    });
  }

  for (const type of getAmcTaxonomy().types) {
    entries.push({
      url: `${SITE.url}/amc/type/${type.id}`,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  for (const problem of getAllAmcProblems()) {
    entries.push({
      url: `${SITE.url}/amc/problem/${problem.id}`,
      changeFrequency: 'monthly',
      priority: 0.4,
      lastModified: new Date(problem.createdAt),
    });
  }

  for (const route of EXAM_ROUTES) {
    entries.push({
      url: `${SITE.url}${route.path}`,
      changeFrequency: 'weekly',
      priority: route.priority,
    });
  }

  // docs/08 item 3: one page per catalog exam. A coming-soon page is short but real (format,
  // scoring, a pointer to the related exam), so it is listed at a lower priority.
  for (const exam of EXAMS) {
    entries.push({
      url: `${SITE.url}${exam.routes.page}`,
      changeFrequency: 'monthly',
      priority: exam.status === 'live' ? 0.7 : 0.4,
    });
  }

  for (const route of TIMED_TEST_ROUTES) {
    entries.push({
      url: `${SITE.url}${route.path}`,
      changeFrequency: 'monthly',
      priority: route.priority,
    });
  }

  for (const test of STD_TESTS) {
    for (const problem of getAllTestProblems(test)) {
      entries.push({
        url: `${SITE.url}/${TEST_SLUG[test]}/problem/${problem.id}`,
        changeFrequency: 'monthly',
        priority: 0.4,
        lastModified: new Date(problem.createdAt),
      });
    }
  }

  return entries;
}
