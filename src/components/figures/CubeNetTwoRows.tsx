import { FigureSvg, Cell, Label } from './primitives.tsx';

/**
 * KA-1233 - a cube net of six squares in two rows of three. The top row holds 1, 2 and 3
 * from left to right; the bottom row starts directly under 3 and holds 4, 5 and 6, so it
 * sticks out two squares to the right of the top row.
 */
export function CubeNetTwoRows() {
  const s = 36;
  const pad = 6;
  const squares: Array<{ label: string; col: number; row: number }> = [
    { label: '1', col: 0, row: 0 },
    { label: '2', col: 1, row: 0 },
    { label: '3', col: 2, row: 0 },
    { label: '4', col: 2, row: 1 },
    { label: '5', col: 3, row: 1 },
    { label: '6', col: 4, row: 1 },
  ];
  return (
    <FigureSvg width={5 * s + 2 * pad} height={2 * s + 2 * pad}>
      {squares.map((sq) => {
        const x = pad + sq.col * s;
        const y = pad + sq.row * s;
        return (
          <g key={`${sq.col}-${sq.row}`}>
            <Cell x={x} y={y} size={s} />
            <Label x={x + s / 2} y={y + s / 2}>
              {sq.label}
            </Label>
          </g>
        );
      })}
    </FigureSvg>
  );
}
