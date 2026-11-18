import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { auditBothThemes } from '@/lib/a11y';
import SatLayout from '../sat/layout';
import SatPage from '../sat/page';
import SatProblemsPage from '../sat/problems/page';
import SatProblemPage from '../sat/problem/[id]/page';
import SatPracticePage from '../sat/practice/page';
import ActLayout from '../act/layout';
import ActPage from '../act/page';
import ActProblemPage from '../act/problem/[id]/page';
import ExamsPage from '../exams/page';
import { getAllTestProblems, getTestTaxonomy } from '@/lib/test-content';
import { buildTestIndexFile, dataPaths } from '@/lib/bank-data';
import { testPracticeItem } from '@/lib/practice-item';
import { resetProgressCache } from '@/components/mastery/useProgress';
import { installStaticDataFetch } from '../../../test/static-data';

/*
 * axe against the SAT and ACT area pages (docs/07 section 4), in both themes. The mock and
 * section-test routes are audited in exam-runner.a11y.test.tsx.
 */

const pathname = vi.hoisted(() => ({ current: '/sat' }));
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePathname: () => pathname.current };
});
vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

const sat = getAllTestProblems('SAT');
const act = getAllTestProblems('ACT');
const satTaxonomy = getTestTaxonomy('SAT');
const actTaxonomy = getTestTaxonomy('ACT');
const firstSat = sat[0];
const firstAct = act[0];
if (!firstSat || !firstAct) throw new Error('the SAT and ACT areas need content to audit');
const satSkill = (id: string) =>
  satTaxonomy.domains.flatMap((d) => d.skills).find((s) => s.id === id)?.name;

beforeEach(() => {
  pathname.current = '/sat';
  window.localStorage.clear();
  resetProgressCache();
  installStaticDataFetch({
    [dataPaths.satIndex]: buildTestIndexFile(satTaxonomy, sat),
    [dataPaths.actIndex]: buildTestIndexFile(actTaxonomy, act),
    ...Object.fromEntries(
      sat.slice(0, 3).map((p) => [dataPaths.problem(p.id), testPracticeItem(p, satSkill)]),
    ),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the SAT and ACT area pages', () => {
  it('/sat, inside the SAT layout, has no axe violations in either theme', async () => {
    const { container } = render(SatLayout({ children: SatPage() }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/act, inside the ACT layout, has no axe violations in either theme', async () => {
    pathname.current = '/act';
    const { container } = render(ActLayout({ children: ActPage() }));
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/sat/problems has no axe violations once the bank has loaded', async () => {
    window.history.replaceState(null, '', '/sat/problems');
    const { container } = render(SatProblemsPage());
    await waitFor(() => expect(container.querySelector('[data-bank-loaded]')).not.toBeNull());
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/sat/problem/[id] and /act/problem/[id] have no axe violations', async () => {
    const satView = render(await SatProblemPage({ params: Promise.resolve({ id: firstSat.id }) }));
    expect(await auditBothThemes(satView.container)).toEqual([]);
    satView.unmount();
    const actView = render(await ActProblemPage({ params: Promise.resolve({ id: firstAct.id }) }));
    expect(await auditBothThemes(actView.container)).toEqual([]);
  });

  it('/sat/practice running a set has no axe violations', async () => {
    const ids = sat.slice(0, 3).map((p) => p.id);
    window.history.replaceState(null, '', `/sat/practice?bank=sat&ids=${ids.join(',')}`);
    const { container } = render(SatPracticePage());
    await screen.findAllByText(/Question 1 of 3/);
    expect(await auditBothThemes(container)).toEqual([]);
  });

  it('/exams has no axe violations', async () => {
    pathname.current = '/exams';
    const { container } = render(ExamsPage());
    expect(await auditBothThemes(container)).toEqual([]);
  });
});
