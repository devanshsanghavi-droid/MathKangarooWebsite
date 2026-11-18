import { FigureSvg, Label, STROKE, GRID, FILL_ACCENT, W_THIN, W_HAIR } from './primitives.tsx';

/** KA-1183 - cups of cocoa sold on five days, on an axis gridded in ones and labelled in twos. */
export function CocoaCupsChart() {
  const bars = [
    { name: 'Mon', value: 6 },
    { name: 'Tue', value: 12 },
    { name: 'Wed', value: 3 },
    { name: 'Thu', value: 10 },
    { name: 'Fri', value: 14 },
  ];
  const max = 14;
  const unit = 8; // pixels per cup
  const baseline = 14 + max * unit;
  const barWidth = 28;
  const gap = 16;
  const left = 32;
  const right = left + bars.length * (barWidth + gap);

  return (
    <FigureSvg width={right + 8} height={baseline + 26}>
      {Array.from({ length: max + 1 }, (_, v) => v).map((v) => (
        <g key={v}>
          <line
            x1={v % 2 === 0 ? left - 4 : left}
            y1={baseline - v * unit}
            x2={right}
            y2={baseline - v * unit}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          {v % 2 === 0 ? (
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
