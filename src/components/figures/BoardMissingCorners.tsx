import { FigureSvg, STROKE, GRID, FILL_SOLID, FILL_NONE, W_THIN, W_THICK } from './primitives.tsx';

/**
 * KA-0034 - a 4 by 4 board coloured like a chessboard with the top-left and bottom-right
 * squares removed. Those two corners are always the same colour, which is the whole point.
 */
export function BoardMissingCorners() {
  const s = 34;
  const pad = 8;
  const removed = new Set(['0-0', '3-3']);
  const cells = [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => [r, c] as const));

  return (
    <FigureSvg width={4 * s + 2 * pad} height={4 * s + 2 * pad}>
      {cells.map(([r, c]) => {
        const key = `${r}-${c}`;
        if (removed.has(key)) {
          return (
            <rect
              key={key}
              x={pad + c * s}
              y={pad + r * s}
              width={s}
              height={s}
              fill={FILL_NONE}
              stroke={GRID}
              strokeWidth={W_THIN}
              strokeDasharray="4 3"
            />
          );
        }
        return (
          <rect
            key={key}
            x={pad + c * s}
            y={pad + r * s}
            width={s}
            height={s}
            fill={(r + c) % 2 === 0 ? FILL_SOLID : FILL_NONE}
            stroke={STROKE}
            strokeWidth={W_THIN}
          />
        );
      })}
      <rect
        x={pad}
        y={pad}
        width={4 * s}
        height={4 * s}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
    </FigureSvg>
  );
}
