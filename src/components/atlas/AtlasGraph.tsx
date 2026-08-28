'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AtlasLayout } from '@/lib/atlas-layout';
import { LAYOUT_CONSTANTS } from '@/lib/atlas-layout';
import { STRAND_META, TIER_META } from '@/lib/taxonomy-meta';
import type { Tier } from '@/lib/schemas';
import { atlasHref, type AtlasQuery } from '@/lib/atlas-params';

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.25;

const TIER_NODE_CLASS: Record<Tier, string> = {
  foundation: 'fill-surface stroke-rule-2',
  core: 'fill-accent-soft stroke-accent',
  gateway: 'fill-p5-bg stroke-p5',
};

/**
 * The Atlas as a diagram.
 *
 * Three things it does that a naive SVG would not:
 *
 *  - **Every node is a real link.** Not a `<g onClick>`: an anchor, so it is in the tab order,
 *    Enter activates it, the browser shows the target, and it works with scripting off. The
 *    accessible name says the skill's name, its tier and how many problems it has, because
 *    "CNT-12" alone tells a screen-reader user nothing.
 *  - **The canvas scrolls at its natural size rather than shrinking to fit.** Ninety-one nodes
 *    across seven columns is about 1700px wide; fitting that into a 780px column scaled every
 *    node down to four pixels and every label below legibility. So the SVG keeps its intrinsic
 *    size, the container scrolls, and zoom changes the rendered size rather than the viewBox.
 *    Scrolling is native, which means it works with the keyboard, with a trackpad, with a
 *    screen reader's own navigation, and with JavaScript switched off.
 *  - **It never animates.** There is no transition to disable under prefers-reduced-motion,
 *    because a diagram that slides while you are reading it is worse for everyone.
 */
export function AtlasGraph({
  layout,
  query,
  bands,
}: {
  layout: AtlasLayout;
  query: AtlasQuery;
  bands: Array<{ tier: Tier; from: number; to: number }>;
}) {
  const [zoom, setZoom] = useState(1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const reset = useCallback(() => {
    setZoom(1);
    const node = surfaceRef.current;
    if (node) node.scrollTo({ left: 0, top: 0 });
  }, []);

  // Non-passive so a modifier-zoom does not also scroll the page. A plain wheel still scrolls,
  // because hijacking the scroll wheel over a large element is the most reliable way to trap a
  // reader halfway down a page.
  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) =>
        Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, current * (event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)),
        ),
      );
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('a')) return; // a click on a node is a click on a link
    const node = event.currentTarget;
    dragging.current = {
      x: event.clientX,
      y: event.clientY,
      left: node.scrollLeft,
      top: node.scrollTop,
    };
    node.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragging.current;
    if (!start) return;
    const node = event.currentTarget;
    node.scrollLeft = start.left - (event.clientX - start.x);
    node.scrollTop = start.top - (event.clientY - start.y);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const button =
    'cursor-pointer rounded-xs border border-rule bg-surface px-2 py-1 text-xs text-ink-2 hover:text-ink';

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Zoom" className="flex items-center gap-1">
          <button
            type="button"
            className={button}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={button}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP))}
            aria-label="Zoom out"
          >
            −
          </button>
          <button type="button" className={button} onClick={reset}>
            Reset
          </button>
          <span className="mono text-2xs text-ink-3">{Math.round(zoom * 100)}%</span>
        </div>
        <p className="m-0 text-2xs text-ink-3">
          Drag to pan, ⌘/Ctrl + scroll to zoom. Every node is also reachable with Tab.
        </p>
      </div>

      {/*
        tabIndex makes the scroll container reachable by keyboard, so arrow keys pan the graph.
        A scrollable region that cannot be focused is unusable without a pointer.
      */}
      <div
        ref={surfaceRef}
        tabIndex={0}
        role="group"
        aria-label="Skill graph, scrollable. Skills sit in columns by strand and in rows by tier, with a line from each skill down to the skills it unlocks."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="max-h-[62vh] cursor-grab overflow-auto rounded-md border border-rule bg-surface"
      >
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={Math.round(layout.width * zoom)}
          height={Math.round(layout.height * zoom)}
          style={{ display: 'block' }}
        >
          {/* Tier bands, drawn first so everything else sits on top of them. */}
          {bands.map((band) => {
            const top = (layout.layerY[band.from] ?? 0) - LAYOUT_CONSTANTS.rowHeight / 2;
            const bottom = (layout.layerY[band.to] ?? 0) + LAYOUT_CONSTANTS.rowHeight / 2;
            return (
              <g key={band.tier}>
                <rect
                  x={0}
                  y={top}
                  width={layout.width}
                  height={bottom - top}
                  className="fill-surface-2"
                  opacity={band.tier === 'core' ? 0.5 : 0.25}
                />
                <text
                  x={6}
                  y={top + 14}
                  className="fill-ink-3"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                >
                  {TIER_META[band.tier].label}
                </text>
              </g>
            );
          })}

          {/* Column headings. */}
          {layout.columns.map((column) => (
            <text
              key={column.strand}
              x={column.x + column.width / 2}
              y={16}
              textAnchor="middle"
              className="fill-ink-2"
              fontSize={11}
              fontFamily="var(--font-mono)"
            >
              {column.strand}
              <title>{STRAND_META[column.strand].name}</title>
            </text>
          ))}

          {/* Edges. Cross-strand ones are dashed so a long diagonal reads as deliberate. */}
          <g aria-hidden="true">
            {layout.edges.map((edge) => (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                className={edge.crossStrand ? 'stroke-rule-2' : 'stroke-rule'}
                strokeWidth={edge.crossStrand ? 0.8 : 1.4}
                strokeDasharray={edge.crossStrand ? '3 3' : undefined}
              />
            ))}
          </g>

          {/* Nodes. */}
          {layout.nodes.map((node) => {
            const focused = query.focus === node.id;
            return (
              <Link
                key={node.id}
                href={atlasHref({ ...query, focus: node.id })}
                scroll={false}
                aria-label={`${node.name}. ${TIER_META[node.tier].label} skill in ${
                  STRAND_META[node.strand].name
                }. ${node.problemCount === 0 ? 'No problems yet' : `${node.problemCount} problem${node.problemCount === 1 ? '' : 's'}`}.`}
                aria-current={focused ? 'true' : undefined}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={focused ? LAYOUT_CONSTANTS.nodeRadius + 3 : LAYOUT_CONSTANTS.nodeRadius}
                  className={TIER_NODE_CLASS[node.tier]}
                  strokeWidth={focused ? 3 : 1.5}
                />
                {/* A hollow ring marks a skill with no problems yet: honest, and not colour-only. */}
                {node.problemCount === 0 ? (
                  <circle cx={node.x} cy={node.y} r={3} className="fill-paper" />
                ) : null}
                <text
                  x={node.x}
                  y={node.y + LAYOUT_CONSTANTS.nodeRadius + 12}
                  textAnchor="middle"
                  className="fill-ink-2"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                >
                  {node.id.slice(4)}
                </text>
              </Link>
            );
          })}
        </svg>
      </div>

      <ul className="m-0 mt-2 flex flex-wrap list-none gap-x-4 gap-y-1 p-0 text-2xs text-ink-3">
        <li>Solid line: prerequisite within a strand</li>
        <li>Dashed line: prerequisite from another strand</li>
        <li>Hollow centre: no problems written yet</li>
      </ul>
    </div>
  );
}
