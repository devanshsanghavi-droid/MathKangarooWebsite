import { FigureSvg, Label, STROKE, GRID, FILL_ACCENT, W_THIN, W_HAIR } from './primitives.tsx';

/** KA-0118 - books read by four children, on an axis marked in steps of five. */
export function BooksBarChart() {
  const bars = [
    { name: 'Ana', value: 10 },
    { name: 'Bo', value: 25 },
    { name: 'Cal', value: 5 },
    { name: 'Dee', value: 15 },
  ];
  const max = 25;
  const unit = 4.4;
  const baseline = 14 + max * unit;
  const barWidth = 30;
  const gap = 20;
  const left = 32;

  return (
    <FigureSvg width={left + bars.length * (barWidth + gap) + 10} height={baseline + 26}>
      {Array.from({ length: max / 5 + 1 }, (_, i) => i * 5).map((v) => (
        <g key={v}>
          <line
            x1={left - 4}
            y1={baseline - v * unit}
            x2={left + bars.length * (barWidth + gap)}
            y2={baseline - v * unit}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          <Label x={left - 16} y={baseline - v * unit}>
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
      <line
        x1={left}
        y1={baseline}
        x2={left + bars.length * (barWidth + gap)}
        y2={baseline}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
    </FigureSvg>
  );
}
