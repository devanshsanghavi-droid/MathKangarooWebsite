import { describe, it, expect } from 'vitest';
import sitemap, { STATIC_ROUTES } from '../sitemap';
import { getAllProblems, getAllSkills } from '@/lib/content';
import { SITE } from '@/lib/site';
import { STRANDS } from '@/lib/schemas';

const entries = sitemap();
const urls = new Set(entries.map((entry) => entry.url));

describe('the sitemap', () => {
  it('is generated from content, not hand-listed', () => {
    for (const skill of getAllSkills()) {
      expect(urls.has(`${SITE.url}/skill/${skill.id}`), skill.id).toBe(true);
    }
    for (const problem of getAllProblems()) {
      expect(urls.has(`${SITE.url}/problem/${problem.id}`), problem.id).toBe(true);
    }
    for (const strand of STRANDS) {
      expect(urls.has(`${SITE.url}/atlas/${strand}`), strand).toBe(true);
    }
    for (const route of STATIC_ROUTES) {
      expect(urls.has(`${SITE.url}${route.path}`), route.path).toBe(true);
    }
  });

  it('lists the learn page for every skill, where the reading actually lives', () => {
    // docs/05 §7.2 moved the definition, the cues, the worked example and the misconceptions
    // off the unit page. The prose has to stay findable.
    for (const skill of getAllSkills()) {
      expect(urls.has(`${SITE.url}/skill/${skill.id}/learn`), skill.id).toBe(true);
    }
  });

  it('leaves the ladders and quizzes out - they are tools, not documents', () => {
    const tools = entries.filter((entry) => /\/(practice\/[345]|quiz)$/.test(entry.url));
    expect(tools).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(urls.size).toBe(entries.length);
  });

  it('gives every entry an absolute URL on this site', () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(`${SITE.url}/`), entry.url).toBe(true);
    }
  });

  it('never advertises a route that would 404', () => {
    const skillIds = new Set(getAllSkills().map((s) => s.id));
    const problemIds = new Set(getAllProblems().map((p) => p.id));
    for (const entry of entries) {
      const path = entry.url.slice(SITE.url.length);
      const skill = /^\/skill\/([^/]+)/.exec(path);
      if (skill?.[1]) expect(skillIds.has(skill[1]), path).toBe(true);
      const problem = /^\/problem\/([^/]+)/.exec(path);
      if (problem?.[1]) expect(problemIds.has(problem[1]), path).toBe(true);
    }
  });
});
