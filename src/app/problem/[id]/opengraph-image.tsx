import { ImageResponse } from 'next/og';
import { getAllProblems, getProblem, getSkill } from '@/lib/content';
import { SITE } from '@/lib/site';
import { themeColor } from '@/lib/theme-colors';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A Kangaroo Atlas problem card';

/** One card per problem, generated at build time. */
export function generateStaticParams(): Array<{ id: string }> {
  return getAllProblems().map((problem) => ({ id: problem.id }));
}

const POINT_TOKEN = { 3: '--p3', 4: '--p4', 5: '--p5' } as const;

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = getProblem(id);

  // Colours come from tokens.css at build time; satori cannot resolve custom properties.
  const paper = themeColor('--paper');
  const ink = themeColor('--ink');
  const ink3 = themeColor('--ink-3');
  const rule = themeColor('--rule');
  const accent = themeColor('--accent');

  if (!problem) {
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: paper,
          color: ink,
          fontSize: 56,
        }}
      >
        {SITE.name}
      </div>,
      size,
    );
  }

  const skill = getSkill(problem.skills.primary);
  const tier = themeColor(POINT_TOKEN[problem.points]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: paper,
        color: ink,
        padding: 72,
        borderLeft: `24px solid ${tier}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 30, color: ink3 }}>
        <span>{problem.id}</span>
        <span style={{ color: tier, fontWeight: 700 }}>{problem.points} point</span>
        <span>Level {problem.band.replace('-', '–')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {skill ? <div style={{ fontSize: 34, color: accent }}>{skill.name}</div> : null}
        <div style={{ fontSize: 52, lineHeight: 1.25 }}>
          {problem.statement.length > 190
            ? `${problem.statement.slice(0, 187)}…`
            : problem.statement}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 26,
          color: ink3,
          borderTop: `2px solid ${rule}`,
          paddingTop: 24,
        }}
      >
        <span>{SITE.name}</span>
        <span>Every wrong answer explains itself.</span>
      </div>
    </div>,
    size,
  );
}
