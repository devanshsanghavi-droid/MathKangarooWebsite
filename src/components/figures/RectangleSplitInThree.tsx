import { FigureSvg, STROKE, FILL_NONE, W_THICK, W_THIN } from './primitives.tsx';

/** KA-0054 — one wide rectangle cut by two vertical lines into three side-by-side parts. */
export function RectangleSplitInThree() {
  const width = 210;
  const height = 70;
  const pad = 8;
  const cuts = [pad + width / 3, pad + (2 * width) / 3];

  return (
    <FigureSvg width={width + 2 * pad} height={height + 2 * pad}>
      <rect
        x={pad}
        y={pad}
        width={width}
        height={height}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      {cuts.map((x) => (
        <line
          key={x}
          x1={x}
          y1={pad}
          x2={x}
          y2={pad + height}
          stroke={STROKE}
          strokeWidth={W_THIN}
        />
      ))}
    </FigureSvg>
  );
}
