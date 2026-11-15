import { FigureSvg, Cell, STROKE, FILL_NONE, W_THICK } from './primitives.tsx';

/**
 * KA-0325 - a staircase of six unit squares standing on a flat base: from left to right,
 * columns one, two and three squares tall, so the top edge steps up twice.
 */
export function StaircaseSquares() {
  const s = 34;
  const pad = 8;
  // [column, row] with row 0 at the top of a three-row grid.
  const cells: Array<[number, number]> = [
    [0, 2],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ];
  const outline = [
    [0, 2],
    [1, 2],
    [1, 1],
    [2, 1],
    [2, 0],
    [3, 0],
    [3, 3],
    [0, 3],
  ]
    .map(([x, y]) => `${pad + (x ?? 0) * s},${pad + (y ?? 0) * s}`)
    .join(' ');

  return (
    <FigureSvg width={3 * s + 2 * pad} height={3 * s + 2 * pad}>
      {cells.map(([c, r]) => (
        <Cell key={`${c}-${r}`} x={pad + c * s} y={pad + r * s} size={s} />
      ))}
      <polygon points={outline} fill={FILL_NONE} stroke={STROKE} strokeWidth={W_THICK} />
    </FigureSvg>
  );
}
