import { FigureSvg, Cell, Label, FILL_SURFACE } from './primitives.tsx';

/**
 * KA-1261 - a cube net of six numbered squares: a row of four labelled 6, 1, 5, 2 from left to
 * right, a square labelled 4 above the second square and a square labelled 3 below the fourth.
 */
export function CubeNetZigzag() {
  const s = 36;
  const pad = 6;
  const rowY = pad + s; // the row of four sits in the middle band
  const squares: Array<{ n: number; x: number; y: number }> = [
    { n: 6, x: pad, y: rowY },
    { n: 1, x: pad + s, y: rowY },
    { n: 5, x: pad + 2 * s, y: rowY },
    { n: 2, x: pad + 3 * s, y: rowY },
    { n: 4, x: pad + s, y: pad },
    { n: 3, x: pad + 3 * s, y: rowY + s },
  ];
  return (
    <FigureSvg width={4 * s + 2 * pad} height={3 * s + 2 * pad}>
      {squares.map((sq) => (
        <g key={sq.n}>
          <Cell x={sq.x} y={sq.y} size={s} fill={FILL_SURFACE} />
          <Label x={sq.x + s / 2} y={sq.y + s / 2}>
            {sq.n}
          </Label>
        </g>
      ))}
    </FigureSvg>
  );
}
