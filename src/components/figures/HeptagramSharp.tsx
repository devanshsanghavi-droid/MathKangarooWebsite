import { FigureSvg, STROKE, STROKE_SOFT, FILL_NONE, W_THICK, W_HAIR } from './primitives.tsx';

/**
 * KA-0993 - seven points equally spaced on a circle, each joined to the two points three places
 * away from it, giving a seven-pointed star with very sharp tips. The circle is drawn faintly
 * because the solver needs it: every tip angle is an angle inscribed in that circle.
 */
export function HeptagramSharp() {
  const cx = 110;
  const cy = 106;
  const r = 88;
  const n = 7;
  const step = 3;

  const round = (v: number) => Math.round(v * 100) / 100;
  const pointAt = (k: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * (k % n)) / n;
    return { x: round(cx + r * Math.cos(a)), y: round(cy + r * Math.sin(a)) };
  };
  const points = Array.from({ length: n }, (_, k) => pointAt(k));

  // Visiting every third point in turn closes the star in one stroke, since 3 and 7 share no factor.
  const starPath = Array.from({ length: n }, (_, k) => pointAt(k * step))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <FigureSvg width={220} height={206}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={FILL_NONE}
        stroke={STROKE_SOFT}
        strokeWidth={W_HAIR}
        strokeDasharray="3 3"
      />
      <polygon
        points={starPath}
        fill={FILL_NONE}
        stroke={STROKE}
        strokeWidth={W_THICK}
        strokeLinejoin="round"
      />
      {points.map((p) => (
        <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r={2.6} fill={STROKE} />
      ))}
    </FigureSvg>
  );
}
