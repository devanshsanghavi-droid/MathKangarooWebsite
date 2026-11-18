import { FigureSvg, Label, STROKE, FILL_ACCENT, W_THIN } from './primitives.tsx';

/**
 * KA-1182 - a pictogram of apples sold on four days. A whole circle stands for 4 apples and a
 * half circle for 2, so the half symbols are the trap.
 */
export function AppleSalesPictogram() {
  const rows = [
    { day: 'Mon', symbols: 3 },
    { day: 'Tue', symbols: 2.5 },
    { day: 'Wed', symbols: 4 },
    { day: 'Thu', symbols: 1.5 },
  ];
  const r = 9;
  const step = 24;
  const rowHeight = 26;
  const left = 54;
  const top = 18;

  const whole = (cx: number, cy: number) => (
    <circle cx={cx} cy={cy} r={r} fill={FILL_ACCENT} stroke={STROKE} strokeWidth={W_THIN} />
  );
  // The left half of a circle, closed along its vertical diameter.
  const half = (cx: number, cy: number) => (
    <path
      d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`}
      fill={FILL_ACCENT}
      stroke={STROKE}
      strokeWidth={W_THIN}
    />
  );

  const keyY = top + rows.length * rowHeight + 10;

  return (
    <FigureSvg width={left + 4 * step + 16} height={keyY + 18}>
      {rows.map((row, i) => {
        const cy = top + i * rowHeight;
        const full = Math.floor(row.symbols);
        const hasHalf = row.symbols - full > 0;
        return (
          <g key={row.day}>
            <Label x={22} y={cy}>
              {row.day}
            </Label>
            {Array.from({ length: full }, (_, k) => (
              <g key={k}>{whole(left + k * step, cy)}</g>
            ))}
            {hasHalf ? half(left + full * step, cy) : null}
          </g>
        );
      })}
      <line
        x1={8}
        y1={keyY - 12}
        x2={left + 4 * step + 8}
        y2={keyY - 12}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      {whole(left, keyY + 4)}
      <Label x={left + 50} y={keyY + 4}>
        = 4 apples
      </Label>
    </FigureSvg>
  );
}
