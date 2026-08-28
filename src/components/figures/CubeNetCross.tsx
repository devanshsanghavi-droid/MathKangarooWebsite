import { FigureSvg, Cell, Label, FILL_ACCENT } from './primitives.tsx';

/**
 * KA-0005 — a cross-shaped cube net: a column of four squares (1–4) with squares 5 and 6
 * attached left and right of square 2. Square 1 is shaded.
 */
export function CubeNetCross() {
  const s = 36;
  const pad = 6;
  const col = pad + s; // the vertical column sits in the middle band
  const squares: Array<{ n: number; x: number; y: number; shaded?: boolean }> = [
    { n: 1, x: col, y: pad, shaded: true },
    { n: 2, x: col, y: pad + s },
    { n: 3, x: col, y: pad + 2 * s },
    { n: 4, x: col, y: pad + 3 * s },
    { n: 5, x: pad, y: pad + s },
    { n: 6, x: col + s, y: pad + s },
  ];
  return (
    <FigureSvg width={3 * s + 2 * pad} height={4 * s + 2 * pad}>
      {squares.map((sq) => (
        <g key={sq.n}>
          <Cell x={sq.x} y={sq.y} size={s} fill={sq.shaded ? FILL_ACCENT : undefined} />
          <Label x={sq.x + s / 2} y={sq.y + s / 2}>
            {sq.n}
          </Label>
        </g>
      ))}
    </FigureSvg>
  );
}
