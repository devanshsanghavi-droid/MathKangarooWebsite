'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RailStrand } from './rail-data';
import { MasteryDot } from '@/components/mastery/MasteryDot';
import { useProgress } from '@/components/mastery/useProgress';
import { masteryStateFor } from '@/lib/local-progress';
import { hasRail } from '@/lib/site';

/**
 * The persistent skill rail — docs/05-DESIGN-DIRECTION.md §7.1.
 *
 * Strand -> skill, the student's position marked with `aria-current`, and a mastery dot on
 * every row. At 900px and up it is a column of the page grid. Below that it is a drawer
 * behind a button in the header, because 260px of tree on a 360px screen leaves nothing for
 * the problem.
 *
 * Three deliberate choices:
 *
 *  - **Each strand is a real `<details>`.** Collapse works with the keyboard, works with
 *    JavaScript off, and needs no ARIA of its own. The strand containing the current page is
 *    open on arrival; the rest are shut, because 91 links unrolled is not navigation.
 *  - **The rail is hidden on pages it would only clutter** — home, legal, contact, the
 *    worksheet printer. `hasRail` in lib/site.ts is the single list, and it is unit tested.
 *  - **Mastery comes from localStorage.** Practice never requires an account, so a signed-out
 *    student sees their own progress here. Nothing is sent anywhere.
 */
export function SkillRail({ strands }: { strands: RailStrand[] }) {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!hasRail(pathname)) return null;

  return (
    <>
      {/* The drawer trigger. Hidden at rail width, where the rail is simply present. */}
      <div className="no-print border-b border-rule bg-ground px-4 py-2 shell:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
          className="ui tap-target inline-flex cursor-pointer items-center gap-2 rounded-sm border border-rule-strong bg-surface px-3 py-2 text-sm font-medium text-ink"
        >
          <RailGlyph />
          Skills
        </button>
      </div>

      <div className="no-print hidden shell:block">
        <RailBody id={`${panelId}-wide`} strands={strands} pathname={pathname} landmark />
      </div>

      {open ? (
        <RailDrawer id={panelId} onClose={() => setOpen(false)}>
          {/*
            No nested landmark here. The drawer is already a dialog named "Skills"; wrapping
            its contents in a second <nav aria-label="Skills"> put two identically-named
            landmarks in one document, which axe flags and which makes a screen reader's
            landmark list ambiguous.
          */}
          <RailBody id={`${panelId}-drawer`} strands={strands} pathname={pathname} />
        </RailDrawer>
      ) : null}
    </>
  );
}

function RailGlyph() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 4h12M2 8h12M2 12h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The drawer. `role="dialog" aria-modal="true"` with focus moved in on open, Escape to close,
 * Tab cycled inside, and focus returned to whatever opened it. Written out rather than reached
 * for from a library because it is forty lines and the dependency budget is deliberately small.
 */
function RailDrawer({
  id,
  onClose,
  children,
}: {
  id: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>('button, a')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...(panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ].filter((node) => node.offsetParent !== null || node.tagName === 'SUMMARY');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="no-print fixed inset-0 z-50 shell:hidden" onKeyDown={onKeyDown}>
      {/* The scrim closes on click but is not a tab stop: the close button is the keyboard path. */}
      <div
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="rail-scrim"
      />
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Skills"
        className="absolute inset-y-0 left-0 flex w-[min(85vw,var(--sidebar-width))] flex-col border-r border-rule bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-rule px-3 py-2">
          <span className="ui text-sm font-semibold text-ink">Skills</span>
          <button
            type="button"
            onClick={onClose}
            className="ui tap-target cursor-pointer rounded-sm px-3 text-sm text-ink-2"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function RailBody({
  id,
  strands,
  pathname,
  landmark = false,
}: {
  id: string;
  strands: RailStrand[];
  pathname: string;
  /** Render as a <nav> landmark. False inside the drawer, whose dialog already names it. */
  landmark?: boolean;
}) {
  const progress = useProgress();
  const now = new Date();
  const currentSkill = /^\/skill\/([A-Z]{3}-\d{2})/.exec(pathname)?.[1] ?? null;
  const currentStrand =
    currentSkill?.slice(0, 3) ?? /^\/atlas\/([A-Z]{3})/.exec(pathname)?.[1] ?? null;

  const Container = landmark ? 'nav' : 'div';

  return (
    <Container
      id={id}
      aria-label={landmark ? 'Skills' : undefined}
      className="shell:sticky shell:top-[57px] shell:max-h-[calc(100dvh-57px)] shell:w-[var(--sidebar-width)] shell:overflow-y-auto shell:border-r shell:border-rule shell:bg-surface-3/40"
    >
      <p className="m-0 px-3 pt-3 pb-1 text-2xs text-ink-3">
        <Link href="/atlas" className="no-underline hover:underline">
          The whole Atlas
        </Link>
      </p>
      <ul className="m-0 list-none p-0 pb-4">
        {strands.map((strand) => (
          <li key={strand.strand}>
            <details open={strand.strand === currentStrand}>
              <summary className="ui flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-ink marker:text-ink-3">
                <span className="flex-1">{strand.name}</span>
                <span className="mono text-2xs text-ink-3">{strand.skills.length}</span>
              </summary>
              <ul className="m-0 list-none p-0">
                {strand.skills.map((skill) => {
                  const active = skill.id === currentSkill;
                  return (
                    <li key={skill.id}>
                      <Link
                        href={`/skill/${skill.id}`}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'flex items-center gap-2 py-1.5 pr-3 pl-5 text-xs no-underline',
                          active
                            ? 'border-l-2 border-accent-600 bg-accent-100 pl-[18px] font-medium text-ink'
                            : 'text-ink-2 hover:text-ink',
                        ].join(' ')}
                      >
                        <MasteryDot size="sm" state={masteryStateFor(progress, skill.id, now)} />
                        <span className="flex-1">{skill.name}</span>
                        <span className="mono text-2xs text-ink-3">{skill.id.slice(4)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </Container>
  );
}
