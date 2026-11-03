import { FigureSvg, STROKE, FILL_NONE, W_THICK, W_THIN } from './primitives.tsx';

/** KA-0003 - one large triangle cut by two lines from the apex into three small triangles. */
export function TriangleSplitInThree() {
  const apex = { x: 100, y: 8 };
  const left = { x: 8, y: 108 };
  const right = { x: 192, y: 108 };
  const base = [
    { x: 69, y: 108 },
    { x: 130, y: 108 },
  ];
  return (
    <FigureSvg width={200} height={120}>
      <polygon
        points={`${apex.x},${apex.y} ${right.x},${right.y} ${left.x},${left.y}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      {base.map((p) => (
        <line
          key={p.x}
          x1={apex.x}
          y1={apex.y}
          x2={p.x}
          y2={p.y}
          stroke={STROKE}
          strokeWidth={W_THIN}
        />
      ))}
    </FigureSvg>
  );
}
