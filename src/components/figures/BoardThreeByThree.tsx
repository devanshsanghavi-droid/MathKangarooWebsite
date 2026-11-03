import { FigureSvg, Cell, W_THICK, STROKE, FILL_NONE } from './primitives.tsx';

/** KA-0001 - a 3 by 3 board of nine equal squares. */
export function BoardThreeByThree() {
  const s = 34;
  const pad = 6;
  const cells = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [r, c] as const));
  return (
    <FigureSvg width={3 * s + 2 * pad} height={3 * s + 2 * pad}>
      {cells.map(([r, c]) => (
        <Cell key={`${r}-${c}`} x={pad + c * s} y={pad + r * s} size={s} />
      ))}
      <rect
        x={pad}
        y={pad}
        width={3 * s}
        height={3 * s}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
    </FigureSvg>
  );
}
