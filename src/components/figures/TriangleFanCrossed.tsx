import { FigureSvg, Label, STROKE, FILL_NONE, W_THICK, W_THIN } from './primitives.tsx';

/**
 * KA-0752 - triangle ABC with three segments from A to points on BC, and one segment parallel
 * to BC joining the other two sides and crossing all three of those segments. The solver counts
 * every triangle in the drawing.
 */
export function TriangleFanCrossed() {
  const apex = { x: 110, y: 18 };
  const left = { x: 12, y: 138 };
  const right = { x: 208, y: 138 };
  /** Feet of the three segments from A on BC. */
  const feet = [62, 104, 160];
  /** The parallel segment sits at this fraction of the way from A down to BC. */
  const t = 0.55;
  const crossY = apex.y + t * (left.y - apex.y);
  const crossLeftX = apex.x + t * (left.x - apex.x);
  const crossRightX = apex.x + t * (right.x - apex.x);

  return (
    <FigureSvg width={220} height={158}>
      <polygon
        points={`${apex.x},${apex.y} ${right.x},${right.y} ${left.x},${left.y}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      {feet.map((x) => (
        <line
          key={x}
          x1={apex.x}
          y1={apex.y}
          x2={x}
          y2={left.y}
          stroke={STROKE}
          strokeWidth={W_THIN}
        />
      ))}
      <line
        x1={crossLeftX}
        y1={crossY}
        x2={crossRightX}
        y2={crossY}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <Label x={apex.x} y={apex.y - 10}>
        A
      </Label>
      <Label x={left.x - 4} y={left.y + 12}>
        B
      </Label>
      <Label x={right.x + 4} y={right.y + 12}>
        C
      </Label>
    </FigureSvg>
  );
}
