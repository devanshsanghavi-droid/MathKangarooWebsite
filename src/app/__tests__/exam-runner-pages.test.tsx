import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AmcMockPage, {
  generateMetadata as amcMockMeta,
  dynamic as amcMockDynamic,
} from '../amc/mock/page';
import AmcSectionPage, { generateMetadata as amcSectionMeta } from '../amc/section/page';
import SatMockPage, { generateMetadata as satMockMeta } from '../sat/mock/page';
import SatSectionPage, { generateMetadata as satSectionMeta } from '../sat/section/page';
import ActMockPage, { generateMetadata as actMockMeta } from '../act/mock/page';
import ActSectionPage, { generateMetadata as actSectionMeta } from '../act/section/page';
import PracticeSectionPage, { generateMetadata as kaSectionMeta } from '../practice/section/page';
import sitemap from '../sitemap';
import { SITE } from '@/lib/site';
import { installExamData } from '../../../test/exam-fixtures';

vi.mock('@/lib/telemetry/client', () => ({ track: vi.fn(() => true) }));

beforeEach(() => {
  window.localStorage.clear();
  installExamData();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** En and em dashes, spelled as escapes so this file contains neither. */
const NO_DASHES = new RegExp('[\\u2013\\u2014]');

const ROUTES = [
  ['/amc/mock', AmcMockPage, amcMockMeta, /AMC mock exam/],
  ['/amc/section', AmcSectionPage, amcSectionMeta, /AMC section test/],
  ['/sat/mock', SatMockPage, satMockMeta, /SAT Math mock test/],
  ['/sat/section', SatSectionPage, satSectionMeta, /SAT Math section test/],
  ['/act/mock', ActMockPage, actMockMeta, /ACT Math mock test/],
  ['/act/section', ActSectionPage, actSectionMeta, /ACT Math section test/],
  ['/practice/section', PracticeSectionPage, kaSectionMeta, /Section test/],
] as const;

describe('the mock and section-test routes', () => {
  it.each(ROUTES)(
    '%s has a real title, description, canonical and OG',
    (path, _Page, meta, title) => {
      const metadata = meta();
      expect(String(metadata.title)).toMatch(title);
      expect(String(metadata.description).length).toBeGreaterThan(60);
      expect(metadata.alternates?.canonical).toBe(path);
      expect(metadata.openGraph?.url).toBe(path);
      expect(String(metadata.description)).not.toMatch(NO_DASHES);
    },
  );

  it.each(ROUTES)('%s prerenders its heading and format facts', (_path, Page, _meta, title) => {
    render(<Page />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(document.querySelector('dl')).not.toBeNull();
  });

  it('are static', () => {
    expect(amcMockDynamic).toBe('force-static');
  });

  it('are in the sitemap', () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const [path] of ROUTES) expect(urls.has(`${SITE.url}${path}`), path).toBe(true);
  });

  it('state the real formats before any script runs', () => {
    render(<AmcMockPage />);
    expect(document.body.textContent).toMatch(/25 questions, 40 minutes/);
    expect(document.body.textContent).toMatch(/6 per right answer, 1.5 per blank, 0 per wrong/);
    render(<SatMockPage />);
    expect(document.body.textContent).toMatch(/44 questions in 2 modules of 22, 35 minutes each/);
    render(<ActMockPage />);
    expect(document.body.textContent).toMatch(/45 questions in 50 minutes/);
  });
});
