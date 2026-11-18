import { FigureSvg, Label, STROKE, GRID, W_THICK, W_THIN, W_HAIR } from './primitives.tsx';

/**
 * KA-1381 - the amount of water in a tank over 35 minutes. The line rises from 0 to 60 litres
 * in the first 10 minutes, stays at 60 litres until minute 15, falls steadily to 20 litres at
 * minute 25, then rises to 80 litres at minute 35.
 */
export function WaterTankGraph() {
  const points: Array<[number, number]> = [
    [0, 0],
    [10, 60],
    [15, 60],
    [25, 20],
    [35, 80],
  ];
  const maxMinutes = 35;
  const maxLitres = 80;
  const xUnit = 7; // pixels per minute
  const yUnit = 2; // pixels per litre
  const left = 40;
  const top = 26;
  const baseline = top + maxLitres * yUnit;
  const right = left + maxMinutes * xUnit;

  const px = (m: number) => left + m * xUnit;
  const py = (l: number) => baseline - l * yUnit;

  return (
    <FigureSvg width={right + 20} height={baseline + 40}>
      {Array.from({ length: maxLitres / 10 + 1 }, (_, i) => i * 10).map((l) => (
        <g key={`l-${l}`}>
          <line
            x1={left - (l % 20 === 0 ? 4 : 0)}
            y1={py(l)}
            x2={right}
            y2={py(l)}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          {l % 20 === 0 ? (
            <Label x={left - 16} y={py(l)}>
              {l}
            </Label>
          ) : null}
        </g>
      ))}
      {Array.from({ length: maxMinutes / 5 + 1 }, (_, i) => i * 5).map((m) => (
        <g key={`m-${m}`}>
          <line
            x1={px(m)}
            y1={top}
            x2={px(m)}
            y2={baseline + 4}
            stroke={GRID}
            strokeWidth={W_HAIR}
          />
          <Label x={px(m)} y={baseline + 14}>
            {m}
          </Label>
        </g>
      ))}
      <line x1={left} y1={top - 6} x2={left} y2={baseline} stroke={STROKE} strokeWidth={W_THIN} />
      <line
        x1={left}
        y1={baseline}
        x2={right + 6}
        y2={baseline}
        stroke={STROKE}
        strokeWidth={W_THIN}
      />
      <polyline
        points={points.map(([m, l]) => `${px(m)},${py(l)}`).join(' ')}
        fill="none"
        stroke={STROKE}
        strokeWidth={W_THICK}
        strokeLinejoin="round"
      />
      <Label x={left + 34} y={top - 16}>
        water (litres)
      </Label>
      <Label x={(left + right) / 2} y={baseline + 30}>
        time (minutes)
      </Label>
    </FigureSvg>
  );
}
