/**
 * Shared drawing primitives for problem figures.
 *
 * Every figure obeys four rules from docs/03-CONTENT-GUIDE.md B7:
 *   - authored as SVG, never a raster image;
 *   - coloured only from tokens, so it follows the theme;
 *   - legible at 320px wide;
 *   - readable in pure black on a printed worksheet (tokens.css flattens the palette
 *     under @media print, so nothing here needs a print-specific branch).
 *
 * Figures are decorative at the DOM level: the meaning lives in the author-written `alt`
 * that <FigureRenderer> puts next to them, so each SVG is aria-hidden and the wrapper owns
 * the accessible name.
 */

import type { ReactNode } from 'react';

export const STROKE = 'var(--ink)';
export const STROKE_SOFT = 'var(--ink-3)';
export const GRID = 'var(--grid)';
export const FILL_NONE = 'none';
export const FILL_SURFACE = 'var(--surface)';
export const FILL_ACCENT = 'var(--accent-100)';
export const FILL_SOLID = 'var(--ink-2)';

/** Line weights are in user units and scale with the viewBox, so they hold at any size. */
export const W_THICK = 2.4;
export const W_THIN = 1.2;
export const W_HAIR = 0.8;

interface FigureSvgProps {
  /** viewBox width and height in user units. */
  width: number;
  height: number;
  children: ReactNode;
}

/**
 * The frame every figure draws inside. Fixes the aspect ratio, caps the rendered width so a
 * figure never dominates a problem statement, and hides the SVG from assistive technology.
 */
export function FigureSvg({ width, height, children }: FigureSvgProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="presentation"
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        width: '100%',
        maxWidth: `${Math.min(width * 1.6, 420)}px`,
        height: 'auto',
        margin: '0 auto',
        overflow: 'visible',
      }}
    >
      {children}
    </svg>
  );
}

/** A square with its top-left corner at (x, y). */
export function Cell({
  x,
  y,
  size,
  fill = FILL_NONE,
  width = W_THIN,
}: {
  x: number;
  y: number;
  size: number;
  fill?: string;
  width?: number;
}) {
  return (
    <rect x={x} y={y} width={size} height={size} fill={fill} stroke={STROKE} strokeWidth={width} />
  );
}

/** A short text label in the mono face, centred on (x, y). */
export function Label({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={STROKE}
      fontFamily="var(--mono)"
      fontSize={11}
    >
      {children}
    </text>
  );
}

/**
 * One cube of an isometric stack, drawn as three rhombi (top, left face, right face).
 * `col` runs right-and-down the page, `row` runs left-and-down, `level` runs up.
 */
export function IsoCube({
  col,
  row,
  level,
  unit = 18,
  originX = 0,
  originY = 0,
}: {
  col: number;
  row: number;
  level: number;
  unit?: number;
  originX?: number;
  originY?: number;
}) {
  const hx = unit;
  const hy = unit / 2;
  const x = originX + (col - row) * hx;
  const y = originY + (col + row) * hy - level * unit;

  const top = `${x},${y} ${x + hx},${y + hy} ${x},${y + unit} ${x - hx},${y + hy}`;
  const left = `${x - hx},${y + hy} ${x},${y + unit} ${x},${y + unit + unit} ${x - hx},${y + hy + unit}`;
  const right = `${x + hx},${y + hy} ${x},${y + unit} ${x},${y + unit + unit} ${x + hx},${y + hy + unit}`;

  return (
    <g>
      <polygon points={left} fill={FILL_SURFACE} stroke={STROKE} strokeWidth={W_THIN} />
      <polygon points={right} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={W_THIN} />
      <polygon points={top} fill={FILL_SURFACE} stroke={STROKE} strokeWidth={W_THIN} />
    </g>
  );
}

/**
 * Painter's order for an isometric stack: the camera looks down the (1, 1, 1) direction, so a
 * cube with a larger col + row + level is nearer and must be drawn later. Sorting rather than
 * relying on declaration order keeps the drawing stable across builds.
 */
export function sortIsometric(cubes: Array<[number, number, number]>) {
  const depth = ([col, row, level]: [number, number, number]) => col + row + level;
  return [...cubes].sort((a, b) => depth(a) - depth(b) || a[2] - b[2] || a[0] - b[0]);
}
