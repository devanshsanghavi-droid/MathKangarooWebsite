import { FigureSvg, Label, STROKE, GRID, FILL_ACCENT, W_THIN, W_HAIR } from './primitives.tsx';

/**
 * KA-0703 - museum visitors on five weekdays. The axis is labelled every 10 with a hairline
 * every 5, so the two bars that end between labels (25 and 35) must be read off a gridline.
 */
export function MuseumVisitorsChart() {
  const bars = [
    { name: 'Mon', value: 40 },
    { name: 'Tue', value: 25 },
    { name: 'Wed', value: 35 },
    { name: 'Thu', value: 30 },
    { name: 'Fri', value: 50 },
  ];
  const max = 50;
  const unit = 2.6;
  const baseline = 14 + max * unit;
  const barWidth = 28;
  const gap = 16;
  const left = 32;
  const right = left + bars.length * (barWidth + gap);

  return (
    <FigureSvg width={right + 10} height={baseline + 26}>
      {Array.from({ length: max / 5 + 1 }, (_, i) => i * 5).map((v) => (
        <g key={v}>
          <line
            x1={left - (v % 10 === 0 ? 4 : 0)}
            y1={baseline - v * unit}
            x2={right}
            y2={baseline - v * unit}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          {v % 10 === 0 ? (
            <Label x={left - 16} y={baseline - v * unit}>
              {v}
            </Label>
          ) : null}
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
