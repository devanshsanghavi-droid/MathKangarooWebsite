import { FigureSvg, Label, STROKE, GRID, FILL_ACCENT, W_THIN, W_HAIR } from './primitives.tsx';

/** KA-0555 - books borrowed on five school days, on an axis marked in steps of two. */
export function LibraryBarChart() {
  const bars = [
    { name: 'Mon', value: 6 },
    { name: 'Tue', value: 10 },
    { name: 'Wed', value: 4 },
    { name: 'Thu', value: 12 },
    { name: 'Fri', value: 8 },
  ];
  const max = 14;
  const unit = 8; // pixels per book
  const baseline = 14 + max * unit;
  const barWidth = 26;
  const gap = 16;
  const left = 30;
  const right = left + bars.length * (barWidth + gap);

  return (
    <FigureSvg width={right + 8} height={baseline + 26}>
      {Array.from({ length: max / 2 + 1 }, (_, i) => i * 2).map((v) => (
        <g key={v}>
          <line
            x1={left - 4}
            y1={baseline - v * unit}
            x2={right}
            y2={baseline - v * unit}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          <Label x={left - 15} y={baseline - v * unit}>
            {v}
          </Label>
        </g>
      ))}
      {bars.map((bar, i) => (
        <g key={bar.name}>
          <rect
            x={left + i * (barWidth + gap) + gap / 2}
            y={baseline - bar.value * unit}
            width={barWidth}
            height={bar.value * unit}
            fill={FILL_ACCENT}
            stroke={STROKE}
            strokeWidth={W_THIN}
          />
          <Label x={left + i * (barWidth + gap) + gap / 2 + barWidth / 2} y={baseline + 14}>
            {bar.name}
          </Label>
        </g>
      ))}
      <line x1={left} y1={14} x2={left} y2={baseline} stroke={STROKE} strokeWidth={W_THIN} />
      <line x1={left} y1={baseline} x2={right} y2={baseline} stroke={STROKE} strokeWidth={W_THIN} />
    </FigureSvg>
  );
}
