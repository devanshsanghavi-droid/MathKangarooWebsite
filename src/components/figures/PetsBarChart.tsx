import { FigureSvg, Label, STROKE, GRID, FILL_ACCENT, W_THIN, W_HAIR } from './primitives.tsx';

/** KA-0015 — a bar chart of four children's pets, with an axis marked in steps of two. */
export function PetsBarChart() {
  const bars = [
    { name: 'Ana', value: 4 },
    { name: 'Leo', value: 2 },
    { name: 'Mia', value: 8 },
    { name: 'Sam', value: 6 },
  ];
  const max = 10;
  const unit = 11; // pixels per pet
  const baseline = 20 + max * unit;
  const barWidth = 30;
  const gap = 18;
  const left = 30;

  return (
    <FigureSvg width={left + bars.length * (barWidth + gap) + 8} height={baseline + 26}>
      {Array.from({ length: max / 2 + 1 }, (_, i) => i * 2).map((v) => (
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
      <line x1={left} y1={20} x2={left} y2={baseline} stroke={STROKE} strokeWidth={W_THIN} />
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
