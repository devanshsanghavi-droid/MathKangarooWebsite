import { FigureSvg, Label, STROKE, GRID, FILL_NONE, W_THIN, W_HAIR } from './primitives.tsx';

/**
 * KA-0020 - three steps: the flat square, the same square folded top to bottom, and that
 * rectangle folded left to right with one hole punched through every layer.
 */
export function FoldPunchSquare() {
  const s = 56;
  const top = 14;
  const xs = [8, 90, 172];
  const dash = { stroke: GRID, strokeWidth: W_HAIR, strokeDasharray: '4 3' };
  const outline = { fill: FILL_NONE, stroke: STROKE, strokeWidth: W_THIN };

  return (
    <FigureSvg width={240} height={100}>
      {/* step 1: the flat sheet, with the first fold line shown */}
      <rect x={xs[0]} y={top} width={s} height={s} {...outline} />
      <line x1={xs[0]} y1={top + s / 2} x2={(xs[0] ?? 0) + s} y2={top + s / 2} {...dash} />
      <Label x={(xs[0] ?? 0) + s / 2} y={top + s + 16}>
        1
      </Label>

      {/* step 2: folded top to bottom, with the second fold line shown */}
      <rect x={xs[1]} y={top + s / 4} width={s} height={s / 2} {...outline} />
      <line
        x1={(xs[1] ?? 0) + s / 2}
        y1={top + s / 4}
        x2={(xs[1] ?? 0) + s / 2}
        y2={top + (3 * s) / 4}
        {...dash}
      />
      <Label x={(xs[1] ?? 0) + s / 2} y={top + s + 16}>
        2
      </Label>

      {/* step 3: folded again, with the punched hole */}
      <rect x={xs[2]} y={top + s / 4} width={s / 2} height={s / 2} {...outline} />
      <circle
        cx={(xs[2] ?? 0) + s / 4}
        cy={top + s / 2}
        r={5}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <Label x={(xs[2] ?? 0) + s / 4} y={top + s + 16}>
        3
      </Label>
    </FigureSvg>
  );
}
