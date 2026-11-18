import { FigureSvg, Cell, Label } from './primitives.tsx';

/**
 * KA-1338 - a cube net of six squares in a staircase of three steps of two squares each.
 * Top row: 1 with 2 to its right. Middle row: 3 below 2, with 4 to its right. Bottom row:
 * 5 below 4, with 6 to its right.
 */
export function CubeNetStepsNumbered() {
  const s = 36;
  const pad = 6;
  const squares: Array<{ label: string; col: number; row: number }> = [
    { label: '1', col: 0, row: 0 },
    { label: '2', col: 1, row: 0 },
    { label: '3', col: 1, row: 1 },
    { label: '4', col: 2, row: 1 },
    { label: '5', col: 2, row: 2 },
    { label: '6', col: 3, row: 2 },
  ];
  return (
    <FigureSvg width={4 * s + 2 * pad} height={3 * s + 2 * pad}>
      {squares.map((sq) => {
        const x = pad + sq.col * s;
        const y = pad + sq.row * s;
        return (
          <g key={sq.label}>
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
