import { FigureSvg, Cell, STROKE, FILL_SOLID, FILL_SURFACE, W_THICK } from './primitives.tsx';

/**
 * KA-0355 - a 4 by 4 grid with a dashed line down the middle. Four squares are shaded left of
 * the line and two to the right; only one shaded pair already mirrors across the line.
 */
export function SymmetryGridDashed() {
  const s = 30;
  const pad = 14;
  const n = 4;
  // [column, row], both counted from 0 at the top-left.
  const shaded = new Set(['0-0', '1-1', '0-2', '1-3', '2-1', '3-3']);
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) cells.push([col, row]);
  }
  const midX = pad + (n / 2) * s;

  return (
    <FigureSvg width={n * s + 2 * pad} height={n * s + 2 * pad}>
      {cells.map(([col, row]) => (
        <Cell
          key={`${col}-${row}`}
          x={pad + col * s}
          y={pad + row * s}
          size={s}
          fill={shaded.has(`${col}-${row}`) ? FILL_SOLID : FILL_SURFACE}
        />
      ))}
      <line
        x1={midX}
        y1={pad - 10}
        x2={midX}
        y2={pad + n * s + 10}
        stroke={STROKE}
        strokeWidth={W_THICK}
        strokeDasharray="6 4"
      />
    </FigureSvg>
  );
}
