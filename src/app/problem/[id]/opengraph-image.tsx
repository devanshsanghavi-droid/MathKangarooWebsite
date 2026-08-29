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

/**
 * docs/05-DESIGN-DIRECTION.md §3: difficulty is the neutral slate ramp with filled dots. The
 * card's left rail is the tier's shade and the dots repeat it in glyphs, so the card still
 * reads as "hard" when it is scaled to a thumbnail or rendered in a monochrome preview.
 */
const TIER_BG = { 3: '--d1-bg', 4: '--d2-bg', 5: '--d3-bg' } as const;
const TIER_FG = { 3: '--d1-fg', 4: '--d2-fg', 5: '--d3-fg' } as const;
const TIER_FILLED = { 3: 1, 4: 2, 5: 3 } as const;

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const problem = getProblem(id);

  // Colours come from tokens.css at build time; satori cannot resolve custom properties.
  const paper = themeColor('--ground');
  const ink = themeColor('--ink');
  const ink3 = themeColor('--ink-3');
  const rule = themeColor('--rule');
  const accent = themeColor('--accent-700');

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
  const tierBg = themeColor(TIER_BG[problem.points]);
  const tierFg = themeColor(TIER_FG[problem.points]);

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
        borderLeft: `24px solid ${tierBg}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 30, color: ink3 }}>
        <span>{problem.id}</span>
        {/*
          The difficulty dots are drawn as shapes, not as ● / ○ glyphs. satori only has the
          fonts it is handed, and asking it for U+25CF made every card try to fetch a font it
          could not get — "Failed to download dynamic font. Status: 400" — and render tofu
          where the tier should be. A circle it can draw from a border-radius on its own.
        */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                border: `3px solid ${tierFg}`,
                background: index < TIER_FILLED[problem.points] ? tierFg : 'transparent',
              }}
            />
          ))}
          <span style={{ color: tierFg, fontWeight: 700, marginLeft: 6 }}>
            {problem.points} point
          </span>
        </span>
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
