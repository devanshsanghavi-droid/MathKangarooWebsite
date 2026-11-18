import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/site';
import { themeColor } from '@/lib/theme-colors';

export const EXAM_OG_SIZE = { width: 1200, height: 630 };

export interface ExamOgOptions {
  /** The pill beside the wordmark: "AMC beta", "SAT Math", "Exams". */
  badge: string;
  kicker: string;
  title: string;
  detail?: string;
  /** The right half of the footer: the area's trademark notice, in short. */
  notice: string;
}

/**
 * The share card for the exam areas (/amc, /sat, /act, /exams). Each route has its own
 * opengraph-image file so a page that sets its own `openGraph` metadata still gets an image
 * (Next attaches a file image at the segment it lives in). Generated at build time; nothing
 * here runs per request.
 *
 * Plain text only. Exam statements carry KaTeX, which satori cannot typeset, so a problem card
 * names the problem's topic or skill rather than quoting it. The footer repeats the area's
 * trademark notice in short, because a card is often all anyone sees of a shared link.
 */
export function examOgImage({
  badge,
  kicker,
  title,
  detail,
  notice,
}: ExamOgOptions): ImageResponse {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 32 }}>
        <span style={{ color: accent, fontWeight: 700 }}>{SITE.name}</span>
        <span
          style={{
            display: 'flex',
            border: `2px solid ${accent}`,
            color: accent,
            borderRadius: 999,
            padding: '4px 16px',
            fontSize: 24,
          }}
        >
          {badge}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 32, color: ink3 }}>{kicker}</div>
        <div style={{ display: 'flex', fontSize: 64, lineHeight: 1.15, maxWidth: 1000 }}>
          {title}
        </div>
        {detail ? (
          <div style={{ display: 'flex', fontSize: 32, color: ink3, maxWidth: 1000 }}>{detail}</div>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 24,
          borderTop: `2px solid ${rule}`,
          paddingTop: 28,
          fontSize: 24,
          color: ink3,
        }}
      >
        <span>Original problems, free, no account</span>
        <span>{notice}</span>
      </div>
    </div>,
    EXAM_OG_SIZE,
  );
}
