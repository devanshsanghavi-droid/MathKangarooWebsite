import { FigureSvg, STROKE, GRID, FILL_NONE, W_THICK, W_THIN, W_HAIR } from './primitives.tsx';

/** KA-0032 — a clock face at exactly three o'clock, with the angle between the hands marked. */
export function ClockThree() {
  const cx = 70;
  const cy = 70;
  const r = 58;
  const marks = Array.from({ length: 12 }, (_, i) => (Math.PI / 6) * i - Math.PI / 2);

  return (
    <FigureSvg width={140} height={140}>
      <circle cx={cx} cy={cy} r={r} fill={FILL_NONE} stroke={STROKE} strokeWidth={W_THICK} />
      {marks.map((angle, i) => (
        <line
          key={i}
          x1={cx + (r - 8) * Math.cos(angle)}
          y1={cy + (r - 8) * Math.sin(angle)}
          x2={cx + r * Math.cos(angle)}
          y2={cy + r * Math.sin(angle)}
          stroke={STROKE}
          strokeWidth={i % 3 === 0 ? W_THIN : W_HAIR}
        />
      ))}
      {/* the marked angle from 12 round to 3 */}
      <path
        d={`M ${cx} ${cy - 26} A 26 26 0 0 1 ${cx + 26} ${cy}`}
        fill={FILL_NONE}
        stroke={GRID}
        strokeWidth={W_THIN}
      />
      {/* minute hand at 12, hour hand at 3 */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 12)} stroke={STROKE} strokeWidth={W_THIN} />
      <line x1={cx} y1={cy} x2={cx + (r - 24)} y2={cy} stroke={STROKE} strokeWidth={W_THICK} />
      <circle cx={cx} cy={cy} r={3.5} fill={STROKE} />
    </FigureSvg>
  );
}
