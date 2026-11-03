import { describe, it, expect } from 'vitest';
import { generateStaticParams, generateMetadata } from '../problem/[id]/page';
import { getAllProblems, getProblem, getSkill } from '@/lib/content';
import { reportProblemUrl } from '@/lib/report';
import { SITE } from '@/lib/site';

describe('generateStaticParams', () => {
  it('emits one page per problem in content/', () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(getAllProblems().length);
    expect(params.map((p) => p.id).sort()).toEqual(
      getAllProblems()
        .map((p) => p.id)
        .sort(),
    );
  });

  it('emits nothing that is not a real problem', () => {
    for (const { id } of generateStaticParams()) {
      expect(getProblem(id), id).toBeDefined();
    }
  });
});

describe('generateMetadata', () => {
  it('names the problem and its primary skill in the title', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'KA-0001' }) });
    expect(meta.title).toBe('KA-0001 - Counting by position (sliding window)');
  });

  it('uses whyOnTest as the description, so no page has a generated-looking summary', async () => {
    for (const problem of getAllProblems()) {
      const meta = await generateMetadata({ params: Promise.resolve({ id: problem.id }) });
      expect(meta.description, problem.id).toBe(problem.whyOnTest);
      expect(meta.alternates?.canonical, problem.id).toBe(`/problem/${problem.id}`);
    }
  });

  it('produces a real title for every problem, never a placeholder', async () => {
    for (const problem of getAllProblems()) {
      const meta = await generateMetadata({ params: Promise.resolve({ id: problem.id }) });
      const skill = getSkill(problem.skills.primary);
      expect(meta.title, problem.id).toBe(skill ? `${problem.id} - ${skill.name}` : problem.id);
    }
  });

  it('refuses to index a page for an id that does not exist', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'KA-9999' }) });
    expect(meta.robots).toEqual({ index: false });
  });
});

describe('reportProblemUrl', () => {
  const problem = { id: 'KA-0001', band: '3-4' as const, points: 3 as const };

  it('opens a prefilled issue on the right repository', () => {
    const url = new URL(reportProblemUrl(problem));
    expect(url.origin + url.pathname).toBe(`${SITE.repo}/issues/new`);
    expect(url.searchParams.get('labels')).toBe('problem-error');
  });

  it('names the problem and the file a maintainer has to open', () => {
    const url = new URL(reportProblemUrl(problem));
    expect(url.searchParams.get('title')).toContain('KA-0001');
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('content/problems/3-4/KA-0001.json');
    expect(body).toContain(`${SITE.url}/problem/KA-0001`);
  });

  it('asks for nothing about the reporter', () => {
    // The users are minors. A report form that asks who you are is a data-collection surface.
    // Whole-word matching, because "Page:" legitimately contains "age".
    const body = new URL(reportProblemUrl(problem)).searchParams.get('body') ?? '';
    for (const word of ['name', 'email', 'age', 'school', 'grade', 'birthday']) {
      expect(body, word).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
    }
  });
});

describe('unknown ids must be a real 404, not a 200 with a "not found" body', () => {
  // Regression guard. With Next's default `dynamicParams: true`, an unknown id rendered the
  // page, hit notFound(), and was then cached and served with HTTP 200 - a wrong URL looked
  // fine to a crawler and to any client that checks the status rather than the words. The set
  // of valid ids is fully known at build time, so the routes opt out of dynamic params.
  it.each([
    ['problem', () => import('../problem/[id]/page')],
    ['skill', () => import('../skill/[id]/page')],
    ['paper', () => import('../papers/[slug]/page')],
    ['strand', () => import('../atlas/[strand]/page')],
  ])('the %s route sets dynamicParams = false', async (_name, load) => {
    const route = (await load()) as { dynamicParams?: boolean };
    expect(route.dynamicParams).toBe(false);
  });
});
