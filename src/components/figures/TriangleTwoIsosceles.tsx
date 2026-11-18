import { FigureSvg, Label, STROKE, FILL_NONE, W_THICK, W_THIN } from './primitives.tsx';

type Pt = { x: number; y: number };

/**
 * Tick marks across the middle of a segment, marking it as one of a set of equal lengths.
 * `count` ticks are drawn side by side, spaced along the segment.
 */
function Ticks({ from, to, count = 1 }: { from: Pt; to: Pt; count?: number }) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  // Unit direction along the segment, and the normal scaled to half the tick length.
  const ux = (to.x - from.x) / len;
  const uy = (to.y - from.y) / len;
  const nx = -uy * 5;
  const ny = ux * 5;
  const gap = 3;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const shift = (i - (count - 1) / 2) * gap;
        const cx = mx + ux * shift;
        const cy = my + uy * shift;
        return (
          <line
            key={i}
            x1={cx - nx}
            y1={cy - ny}
            x2={cx + nx}
            y2={cy + ny}
            stroke={STROKE}
            strokeWidth={W_THIN}
          />
        );
      })}
    </>
  );
}

/**
 * KA-1274 - triangle ABC with apex A and base BC (AB = AC, stated in the problem), and a point D
 * on AC joined to B with BD = BC (two ticks each, so they do not read as one tick near D). The angle at A is marked 40 degrees. Drawn to
 * scale (angles A, B, C are 40, 70 and 70 degrees, and angle ABD is 30 degrees).
 */
export function TriangleTwoIsosceles() {
  const A: Pt = { x: 95, y: 16.4 };
  const B: Pt = { x: 50, y: 140 };
  const C: Pt = { x: 140, y: 140 };
  const D: Pt = { x: 118.9, y: 82.2 };
  const r = 22;
  // Arc at A from the direction of AB (110 degrees, y pointing down) to AC (70 degrees).
  const arcStart = {
    x: A.x + r * Math.cos((110 * Math.PI) / 180),
    y: A.y + r * Math.sin((110 * Math.PI) / 180),
  };
  const arcEnd = {
    x: A.x + r * Math.cos((70 * Math.PI) / 180),
    y: A.y + r * Math.sin((70 * Math.PI) / 180),
  };
  return (
    <FigureSvg width={190} height={156}>
      <polygon
        points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
      />
      <line x1={B.x} y1={B.y} x2={D.x} y2={D.y} stroke={STROKE} strokeWidth={W_THIN} />
      <Ticks from={B} to={D} count={2} />
      <Ticks from={B} to={C} count={2} />
      <path
        d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 0 0 ${arcEnd.x} ${arcEnd.y}`}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <Label x={A.x} y={A.y + 36}>
        40°
      </Label>
      <Label x={A.x} y={A.y - 10}>
        A
      </Label>
      <Label x={B.x - 8} y={B.y + 9}>
        B
      </Label>
      <Label x={C.x + 8} y={C.y + 9}>
        C
      </Label>
      <Label x={D.x + 10} y={D.y + 3}>
        D
      </Label>
    </FigureSvg>
  );
}
