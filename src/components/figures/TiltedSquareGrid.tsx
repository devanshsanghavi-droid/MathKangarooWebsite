import { FigureSvg, Cell, STROKE, FILL_ACCENT, FILL_NONE, W_THICK } from './primitives.tsx';

/**
 * KA-0475 - a 6 by 6 grid with a tilted shaded square whose corners sit on the sides of the
 * big square, each 2 units along from a corner: (2,0), (6,2), (4,6), (0,4). The four white
 * corner pieces are right triangles with legs 2 and 4.
 */
export function TiltedSquareGrid() {
  const s = 24; // pixels per small square
  const pad = 8;
  const n = 6;
  const cells = Array.from({ length: n * n }, (_, i) => [Math.floor(i / n), i % n] as const);
  const corners: Array<[number, number]> = [
    [2, 0],
    [6, 2],
    [4, 6],
    [0, 4],
  ];
  const shaded = corners.map(([x, y]) => `${pad + x * s},${pad + y * s}`).join(' ');

  return (
    <FigureSvg width={n * s + 2 * pad} height={n * s + 2 * pad}>
      <polygon points={shaded} fill={FILL_ACCENT} stroke="none" />
      {cells.map(([r, c]) => (
        <Cell key={`${r}-${c}`} x={pad + c * s} y={pad + r * s} size={s} />
      ))}
      <polygon points={shaded} fill={FILL_NONE} stroke={STROKE} strokeWidth={W_THICK} />
      <rect
        x={pad}
        y={pad}
        width={n * s}
        height={n * s}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
    </FigureSvg>
  );
}
