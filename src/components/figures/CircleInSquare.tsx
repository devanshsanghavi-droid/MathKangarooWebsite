import {
  FigureSvg,
  Label,
  STROKE,
  FILL_ACCENT,
  FILL_SURFACE,
  W_THICK,
  W_THIN,
} from './primitives.tsx';

/**
 * KA-0052 - a circle inscribed in a square, touching the midpoint of each side. The four
 * corner pieces are shaded: that is the region the question asks about.
 */
export function CircleInSquare() {
  const side = 150;
  const pad = 22;

  return (
    <FigureSvg width={side + 2 * pad} height={side + 2 * pad}>
      {/* The square is filled, then the circle punches a hole in it, leaving the corners. */}
      <rect
        x={pad}
        y={pad}
        width={side}
        height={side}
        fill={FILL_ACCENT}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      <circle
        cx={pad + side / 2}
        cy={pad + side / 2}
        r={side / 2}
        fill={FILL_SURFACE}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <line
        x1={pad + side / 2}
        y1={pad + side / 2}
        x2={pad + side}
        y2={pad + side / 2}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <Label x={pad + (3 * side) / 4} y={pad + side / 2 - 10}>
        5
      </Label>
      <Label x={pad + side / 2} y={pad + side + 12}>
        10
      </Label>
    </FigureSvg>
  );
}
