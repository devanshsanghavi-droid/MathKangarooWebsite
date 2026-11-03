import { ImageResponse } from 'next/og';
import { getContentStats } from '@/lib/content';
import { SITE } from '@/lib/site';
import { themeColor } from '@/lib/theme-colors';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Kangaroo Atlas: Math Kangaroo preparation organised by skill';

/**
 * The share card for the home page, and the fallback for every route that has no card of its
 * own. The home page declared `summary_large_image` with no image behind it, so a shared link
 * rendered as a bare grey box. Generated at build time; nothing here runs per request.
 */
export default function OpenGraphImage() {
  const stats = getContentStats();
  const paper = themeColor('--ground');
  const ink = themeColor('--ink');
  const ink3 = themeColor('--ink-3');
  const accent = themeColor('--accent-700');
  const rule = themeColor('--rule');

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
        padding: 80,
        borderLeft: `24px solid ${accent}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 34, color: accent, fontWeight: 700 }}>
        {SITE.name}
      </div>
      <div style={{ display: 'flex', fontSize: 64, lineHeight: 1.15, maxWidth: 960 }}>
        {SITE.tagline}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: `2px solid ${rule}`,
          paddingTop: 28,
          fontSize: 28,
          color: ink3,
        }}
      >
        <span>
          {stats.skills} skills, {stats.problems} original problems, free
        </span>
        <span>Independent. Not affiliated with Math Kangaroo.</span>
      </div>
    </div>,
    size,
  );
}
