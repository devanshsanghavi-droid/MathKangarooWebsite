import {
  FigureSvg,
  Label,
  STROKE,
  GRID,
  FILL_ACCENT,
  FILL_NONE,
  W_THICK,
  W_HAIR,
} from './primitives.tsx';

/** KA-0027 — a square of side 10 with a square of side 4 removed from the top-right corner. */
export function SquareWithCorner() {
  const u = 13; // pixels per unit of length
  const pad = 22;
  const big = 10 * u;
  const cut = 4 * u;
  const shaded = [
    [0, 0],
    [6, 0],
    [6, 4],
    [10, 4],
    [10, 10],
    [0, 10],
  ]
    .map(([x, y]) => `${pad + (x ?? 0) * u},${pad + (y ?? 0) * u}`)
    .join(' ');

  return (
    <FigureSvg width={big + 2 * pad} height={big + 2 * pad}>
      <polygon points={shaded} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={W_THICK} />
      <rect
        x={pad + 6 * u}
        y={pad}
        width={cut}
        height={cut}
        fill={FILL_NONE}
        stroke={GRID}
        strokeWidth={W_HAIR}
        strokeDasharray="4 3"
      />
      <Label x={pad + big / 2} y={pad + big + 12}>
        10
      </Label>
      <Label x={pad + 8 * u} y={pad - 10}>
        4
      </Label>
    </FigureSvg>
  );
}
