import { FigureSvg, Cell, STROKE, FILL_NONE, W_THICK } from './primitives.tsx';

/**
 * KA-0013 — an L of five unit squares: a column three tall, with two more squares extending
 * to the right along the bottom.
 */
export function LShapeUnits() {
  const s = 34;
  const pad = 8;
  const cells: Array<[number, number]> = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ];
  const outline = [
    [0, 0],
    [1, 0],
    [1, 2],
    [3, 2],
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
