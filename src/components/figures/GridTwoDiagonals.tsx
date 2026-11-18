import { FigureSvg, Cell, STROKE, FILL_SOLID, FILL_SURFACE, W_THICK } from './primitives.tsx';

/**
 * KA-1269 - a 5 by 5 grid with both diagonals drawn dashed. Three squares are shaded: row 1
 * column 2, row 2 column 5 and row 4 column 4 (rows from the top, columns from the left).
 */
export function GridTwoDiagonals() {
  const s = 26;
  const pad = 14;
  const n = 5;
  // [column, row], both counted from 0 at the top-left.
  const shaded = new Set(['1-0', '4-1', '3-3']);
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) cells.push([col, row]);
  }
  const lo = pad - 8;
  const hi = pad + n * s + 8;

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
        x1={lo}
        y1={lo}
        x2={hi}
        y2={hi}
        stroke={STROKE}
        strokeWidth={W_THICK}
        strokeDasharray="6 4"
      />
      <line
        x1={hi}
        y1={lo}
        x2={lo}
        y2={hi}
        stroke={STROKE}
        strokeWidth={W_THICK}
        strokeDasharray="6 4"
      />
    </FigureSvg>
  );
}
